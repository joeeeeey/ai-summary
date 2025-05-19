variable "application_name" {
  description = "Name of the App Runner application"
  type        = string
}

variable "image_identifier" {
  description = "ECR image URI"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_connector_subnets" {
  description = "List of subnet IDs for VPC connector"
  type        = list(string)
}

variable "vpc_security_groups" {
  description = "List of security group IDs for VPC connector"
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

variable "pinecone_api_key" {
  description = "Pinecone API key for vector database"
  type        = string
  sensitive   = true
} 