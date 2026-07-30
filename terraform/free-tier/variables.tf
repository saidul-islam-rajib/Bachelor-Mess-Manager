variable "aws_region" {
  description = "AWS region. Keep every resource in one region to stay inside the free tier."
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  type    = string
  default = "bachelor-point"
}

variable "owner_name" {
  type    = string
  default = "Saidul Islam Rajib"
}

variable "instance_type" {
  description = <<-EOT
    t3.micro  is free-tier eligible (750 hrs/month for 12 months) but has only 1 GB RAM.
              A 2 GB swapfile is created to make k3s usable at that size.
    t3.small  has 2 GB RAM and is much more comfortable, at roughly 15 USD/month.
  EOT
  type    = string
  default = "t3.micro"
}

variable "root_volume_size" {
  description = "EBS root volume in GiB. Free tier covers 30 GiB total."
  type        = number
  default     = 30
}

variable "db_instance_class" {
  description = "db.t3.micro is free-tier eligible for SQL Server Express."
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Free tier covers 20 GiB of RDS storage."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  type    = string
  default = "15.00.4415.2.v1"
}

variable "db_username" {
  type    = string
  default = "bpadmin"
}

variable "admin_email" {
  description = "Administrator account created on first boot"
  type        = string
  default     = "admin@bachelorpoint.local"
}

variable "admin_password" {
  description = "Administrator password. Leave empty to have one generated."
  type        = string
  default     = ""
  sensitive   = true
}

variable "allowed_admin_cidr" {
  description = <<-EOT
    CIDR allowed to reach SSH (22) and the k3s API (6443).
    Set this to YOUR_IP/32. Find it with: curl -s https://checkip.amazonaws.com
    Leaving it as 0.0.0.0/0 exposes SSH and the Kubernetes API to the whole internet.
  EOT
  type    = string
  default = "0.0.0.0/0"
}

variable "public_key_path" {
  description = "Existing SSH public key to install. Leave empty to generate a new key pair."
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Optional hostname. Leave empty to use the EC2 public IP with nip.io."
  type        = string
  default     = ""
}
