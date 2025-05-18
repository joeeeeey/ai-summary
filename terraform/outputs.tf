output "apprunner_service_url" {
  description = "The URL of the App Runner service"
  value       = module.apprunner.service_url
}

output "rds_endpoint" {
  description = "The RDS database endpoint"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "database_connection_string" {
  description = "Database connection string (without password)"
  value       = "mysql://${var.database_username}:****@${module.rds.db_instance_endpoint}/${var.database_name}"
  sensitive   = true
}

output "ecr_repository_url" {
  description = "The URL of the ECR repository"
  value       = module.ecr.repository_url
} 