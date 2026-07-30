variable "aws_region" {
  description = "AWS region for every resource"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Short project identifier used in resource names"
  type        = string
  default     = "bachelor-point"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "owner_name" {
  description = "Owner tag applied to every resource"
  type        = string
  default     = "Saidul Islam Rajib"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zone_count" {
  description = "How many AZs to spread across"
  type        = number
  default     = 2
}

variable "kubernetes_version" {
  description = "EKS control plane version"
  type        = string
  default     = "1.30"
}

variable "node_instance_types" {
  description = "EC2 instance types for the managed node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_desired_size" {
  description = "Desired worker node count"
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum worker node count"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum worker node count"
  type        = number
  default     = 5
}

variable "db_instance_class" {
  description = "RDS instance class for SQL Server"
  type        = string
  default     = "db.t3.small"
}

variable "db_allocated_storage" {
  description = "RDS storage in GiB"
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "SQL Server engine version"
  type        = string
  default     = "15.00.4415.2.v1"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "messadmin"
}

variable "db_backup_retention_days" {
  description = "How many days of automated backups to keep"
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Run RDS across two AZs. Doubles cost, removes a single point of failure."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Public hostname for the application, for example mess.example.com"
  type        = string
  default     = ""
}
