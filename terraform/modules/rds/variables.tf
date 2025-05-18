variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
}

variable "database_subnet_group_name" {
  description = "The name of the database subnet group"
  type        = string
}

variable "database_username" {
  description = "Username for the RDS database"
  type        = string
}

variable "database_password" {
  description = "Password for the RDS database"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Name of the database"
  type        = string
}

variable "rds_security_group_id" {
  description = "ID of the security group for RDS"
  type        = string
} 