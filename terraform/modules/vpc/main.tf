# Use the default VPC instead of creating a new one
data "aws_vpc" "default" {
  default = true
}

# Get the default subnets
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_subnet" "default" {
  for_each = toset(data.aws_subnets.default.ids)
  id       = each.value
}

# Create DB subnet group using default subnets
resource "aws_db_subnet_group" "main" {
  name       = "ai-summary-db-subnet-group"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "ai-summary-db-subnet-group"
  }
}

# Security group for RDS
resource "aws_security_group" "rds" {
  name        = "ai-summary-rds-sg"
  description = "Security group for RDS database"
  vpc_id      = data.aws_vpc.default.id

  # tmp allow all ip for 3306

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # ingress {
  #   from_port   = 3306
  #   to_port     = 3306
  #   protocol    = "tcp"
  #   cidr_blocks = ["157.254.38.187/32", "180.158.101.107/32"]
  # }

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ai-summary-rds-sg"
  }
}

# Security group for App Runner
resource "aws_security_group" "app" {
  name        = "ai-summary-app-sg"
  description = "Security group for App Runner VPC connector"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ai-summary-app-sg"
  }
} 