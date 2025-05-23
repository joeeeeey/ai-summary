output "repository_url" {
  description = "The URL of the ECR repository"
  value       = aws_ecr_repository.app.repository_url
}

output "registry_id" {
  description = "The registry ID where the repository was created"
  value       = aws_ecr_repository.app.registry_id
}

output "repository_name" {
  description = "The name of the ECR repository"
  value       = aws_ecr_repository.app.name
} 