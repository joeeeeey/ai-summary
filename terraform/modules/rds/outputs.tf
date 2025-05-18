output "db_instance_endpoint" {
  description = "The connection endpoint of the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "database_url" {
  description = "The database connection URL"
  value       = local.db_connection_string
  sensitive   = true
} 