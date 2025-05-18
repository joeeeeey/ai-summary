variable "application_name" {
  description = "Name of the application"
  type        = string
}

variable "image_identifier" {
  description = "ECR repository URL with image tag"
  type        = string
  default     = "ai-summary-app:latest"
}

variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
}

variable "vpc_connector_subnets" {
  description = "List of subnet IDs for the VPC connector"
  type        = list(string)
}

variable "vpc_security_groups" {
  description = "List of security group IDs for the VPC connector"
  type        = list(string)
}

variable "database_url" {
  description = "Database connection URL"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key for authentication"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
} 