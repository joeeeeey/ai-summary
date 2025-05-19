provider "aws" {
  region = var.aws_region
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # backend "s3" {
  #   bucket = "ai-summary-terraform-state"
  #   key    = "terraform.tfstate"
  #   region = "ap-southeast-1"
  # }
}

module "ecr" {
  source = "./modules/ecr"
  
  repository_name = var.ecr_repository_name
}

module "vpc" {
  source = "./modules/vpc"
  
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  private_subnet_cidrs = var.private_subnet_cidrs
  public_subnet_cidrs  = var.public_subnet_cidrs
}

module "rds" {
  source = "./modules/rds"
  
  vpc_id                    = module.vpc.vpc_id
  database_subnet_group_name = module.vpc.database_subnet_group_name
  database_password         = var.database_password
  database_username         = var.database_username
  database_name             = var.database_name
  rds_security_group_id     = module.vpc.rds_security_group_id
}

# Do it after above dependencies are created
module "apprunner" {
  source = "./modules/apprunner"
  
  image_identifier      = var.image_identifier
  application_name      = var.application_name
  vpc_id                = module.vpc.vpc_id
  vpc_connector_subnets = module.vpc.private_subnet_ids
  vpc_security_groups   = [module.vpc.app_security_group_id]
  # database_url          = module.rds.database_url
  database_url          = var.database_url
  jwt_secret            = var.jwt_secret
  openai_api_key        = var.openai_api_key
  pinecone_api_key      = var.pinecone_api_key
} 
