data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  name = var.project_name
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)

  admin_password = var.admin_password != "" ? var.admin_password : random_password.admin.result

  database_url = join("", [
    "sqlserver://", aws_db_instance.sqlserver.address, ":1433",
    ";database=bachelor_point",
    ";user=", var.db_username,
    ";password=", random_password.db.result,
    ";encrypt=true;trustServerCertificate=true"
  ])
}

resource "random_password" "db" {
  length           = 24
  special          = true
  override_special = "_-"
}

resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

resource "random_password" "admin" {
  length           = 20
  special          = true
  override_special = "_-"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.10.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-igw" }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.name}-public-${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "server" {
  name        = "${local.name}-server"
  description = "k3s node: web traffic from anywhere, admin ports from one address"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_admin_cidr]
  }

  ingress {
    description = "Kubernetes API for kubectl and Jenkins"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = [var.allowed_admin_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-server-sg" }
}

resource "aws_security_group" "database" {
  name        = "${local.name}-db"
  description = "SQL Server reachable only from the k3s node"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "SQL Server from the application server"
    from_port       = 1433
    to_port         = 1433
    protocol        = "tcp"
    security_groups = [aws_security_group.server.id]
  }

  tags = { Name = "${local.name}-db-sg" }
}

resource "tls_private_key" "ssh" {
  count = var.public_key_path == "" ? 1 : 0

  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "local_sensitive_file" "ssh_key" {
  count = var.public_key_path == "" ? 1 : 0

  content         = tls_private_key.ssh[0].private_key_openssh
  filename        = "${path.module}/${local.name}-key.pem"
  file_permission = "0600"
}

resource "aws_key_pair" "main" {
  key_name   = "${local.name}-key"
  public_key = var.public_key_path == "" ? tls_private_key.ssh[0].public_key_openssh : file(var.public_key_path)
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db-subnets"
  subnet_ids = aws_subnet.public[*].id

  tags = { Name = "${local.name}-db-subnets" }
}

resource "aws_db_instance" "sqlserver" {
  identifier = "${local.name}-db"

  engine         = "sqlserver-ex"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class
  license_model  = "license-included"

  allocated_storage = var.db_allocated_storage
  storage_type      = "gp2"
  storage_encrypted = false

  username = var.db_username
  password = random_password.db.result
  port     = 1433

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "18:00-19:00"
  maintenance_window      = "sun:19:30-sun:20:30"

  auto_minor_version_upgrade = true
  deletion_protection        = false
  skip_final_snapshot        = true
  apply_immediately          = true

  lifecycle {
    ignore_changes = [engine_version]
  }
}

resource "aws_instance" "server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = aws_key_pair.main.key_name
  subnet_id     = aws_subnet.public[0].id

  vpc_security_group_ids = [aws_security_group.server.id]

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = false
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  user_data_replace_on_change = true
  user_data = templatefile("${path.module}/user-data.sh", {
    database_url   = local.database_url
    auth_secret    = random_password.auth_secret.result
    admin_email    = var.admin_email
    admin_password = local.admin_password
    app_name       = var.project_name
  })

  tags = { Name = "${local.name}-server" }

  depends_on = [aws_db_instance.sqlserver]
}

resource "aws_eip" "server" {
  instance = aws_instance.server.id
  domain   = "vpc"

  tags = { Name = "${local.name}-eip" }
}
