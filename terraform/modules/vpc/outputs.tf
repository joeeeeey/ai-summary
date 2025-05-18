output "vpc_id" {
  description = "The ID of the VPC"
  value       = data.aws_vpc.default.id
}

output "private_subnet_ids" {
  description = "List of IDs of private subnets"
  value       = data.aws_subnets.default.ids
}

output "public_subnet_ids" {
  description = "List of IDs of public subnets"
  value       = data.aws_subnets.default.ids
}

output "database_subnet_group_name" {
  description = "Name of the database subnet group"
  value       = aws_db_subnet_group.main.name
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "app_security_group_id" {
  description = "ID of the application security group"
  value       = aws_security_group.app.id
} 