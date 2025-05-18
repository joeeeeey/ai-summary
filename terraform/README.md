# AI Summary Terraform Infrastructure

This directory contains Terraform code for deploying the AI Summary application infrastructure on AWS.

## Infrastructure Components

The infrastructure consists of the following components:

1. **ECR (Elastic Container Registry)** - Stores the Docker images for the application
2. **VPC (Virtual Private Cloud)** - Networking infrastructure for the application
3. **RDS (Relational Database Service)** - MySQL database for the application
4. **App Runner** - Managed service for running the containerized application

## Component Interactions

Here's how these components interact:

- **ECR**: Provides a repository URL where the Docker image is pushed and stored. App Runner pulls the image from this repository.
- **VPC**: Contains the networking setup, including security groups that control access between components.
- **RDS**: Hosts the MySQL database. The database connection string is passed to App Runner as an environment variable.
- **App Runner**: Runs the containerized application, connects to the VPC via a VPC connector, and communicates with the RDS database.

### Dependencies

The infrastructure has the following dependencies:

1. ECR repository must be created first (for image storage)
2. VPC and its components (subnets, security groups) must be created before RDS and App Runner
3. RDS database must be created before App Runner (to provide the connection string)
4. App Runner service is created last, using outputs from all other modules

The security group setup ensures that:
- The RDS database is only accessible from the App Runner service (via security group rules)
- The App Runner service can access the internet and the RDS database

## How to Deploy

### Prerequisites

1. AWS CLI installed and configured
2. Terraform installed
3. Docker installed (for building and pushing images)

### Deployment Steps

1. **Initialize Terraform**

```bash
terraform init
```

2. **Configure Variables**

Copy the example variables file and update with your values:

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your specific values
```

3. **Plan the Deployment**

```bash
terraform plan -out=tfplan
```

4. **Apply the Changes**

```bash
terraform apply tfplan
```

5. **Build and Push Docker Image**

After the ECR repository is created, build and push your Docker image:

```bash
# Log in to ECR
aws ecr get-login-password --region $(terraform output -raw aws_region) | docker login --username AWS --password-stdin $(terraform output -raw ecr_repository_url)

# Build and tag the image
docker build -t $(terraform output -raw ecr_repository_url):latest .

# Push the image
docker push $(terraform output -raw ecr_repository_url):latest
```

6. **Update App Runner Service**

If you've updated your Docker image and need to redeploy:

```bash
# redeploy
aws apprunner start-deployment --service-arn arn:aws:apprunner:ap-southeast-1:922446598046:service/ai-summary-app/29ea7e03880f49c5b2af67ce6f79df79

# get ENV
aws apprunner describe-service --service-arn arn:aws:apprunner:ap-southeast-1:922446598046:service/ai-summary-app/29ea7e03880f49c5b2af67ce6f79df79 --query 'Service.SourceConfiguration.ImageRepository.ImageConfiguration.RuntimeEnvironmentVariables'
```

## Important Notes

1. The ECR module's `main.tf` file appears to be empty and needs to be implemented to create the ECR repository.
2. The RDS module creates a database connection string that is passed to App Runner.
3. App Runner connects to the VPC using a VPC connector, allowing it to access the RDS database securely.

## Cleanup

To destroy all resources when no longer needed:

```bash
terraform destroy
``` 