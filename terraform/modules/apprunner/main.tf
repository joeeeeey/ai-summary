resource "aws_apprunner_vpc_connector" "connector" {
  vpc_connector_name = "${var.application_name}-vpc-connector"
  subnets            = var.vpc_connector_subnets
  security_groups    = var.vpc_security_groups
}

resource "aws_iam_role" "apprunner_ecr_access_role" {
  name = "apprunner-ecr-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access_role_attachment" {
  role       = aws_iam_role.apprunner_ecr_access_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# Create a separate role for the App Runner instance
resource "aws_iam_role" "apprunner_instance_role" {
  name = "apprunner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
      }
    ]
  })
}

# Add basic execution policy to the instance role
resource "aws_iam_role_policy_attachment" "apprunner_instance_basic" {
  role       = aws_iam_role.apprunner_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

resource "aws_apprunner_service" "service" {
  service_name = var.application_name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access_role.arn
    }
    
    image_repository {
      image_configuration {
        port = "8080"
        runtime_environment_variables = {
          "DATABASE_URL" = var.database_url
          "JWT_SECRET"   = var.jwt_secret
          "OPENAI_API_KEY" = var.openai_api_key
          "PINECONE_API_KEY" = var.pinecone_api_key
        }
      }
      image_identifier      = var.image_identifier
      image_repository_type = "ECR"
    }
    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu = "1 vCPU"
    memory = "2 GB"
    instance_role_arn = aws_iam_role.apprunner_instance_role.arn
  }

  health_check_configuration {
    protocol = "HTTP"
    path = "/api/health"
    interval = 5
    timeout = 2
    healthy_threshold = 1
    unhealthy_threshold = 3
  }

  network_configuration {
    egress_configuration {
      egress_type = "DEFAULT"
    }
    ingress_configuration {
      is_publicly_accessible = true
    }
  }

  tags = {
    Name = var.application_name
  }
} 