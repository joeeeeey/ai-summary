AWS_REGION ?= ap-southeast-1
ECR_REPOSITORY_URL ?= 922446598046.dkr.ecr.$(AWS_REGION).amazonaws.com/ai-summary-app

build:
	docker build -t ai-summary-app .

run:
	docker run -p 3000:3000 ai-summary-app

docker-tag:
	docker tag ai-summary-app:latest $(ECR_REPOSITORY_URL):latest

push:
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(ECR_REPOSITORY_URL)
	docker push $(ECR_REPOSITORY_URL):latest

update-docker-image: build docker-tag push

fix-docker-networking:
	mv ~/.docker/config.json ~/.docker/config.json.bak
	echo '{"credsStore":"", "auths":{}}' > ~/.docker/config.json

# Terraform commands
tf-init:
	cd terraform && terraform init

# Create tfvars from example if it doesn't exist
tf-setup:
	@if [ ! -f terraform/terraform.tfvars ]; then \
		echo "Creating terraform.tfvars from example..."; \
		cp terraform/terraform.tfvars.example terraform/terraform.tfvars; \
		echo "Please review and update variables in terraform/terraform.tfvars"; \
	else \
		echo "terraform.tfvars already exists"; \
	fi

tf-plan:
	cd terraform && terraform plan -out=tfplan

tf-apply:
	cd terraform && terraform apply tfplan

tf-destroy:
	cd terraform && terraform destroy

tf-fmt:
	cd terraform && terraform fmt -recursive

# Create just the ECR repository
create-ecr:
	cd terraform && terraform apply -target=module.ecr

# Get the ECR repository URL
get-ecr-url:
	cd terraform && terraform output -json | jq -r '.ECR_REPOSITORY_URLsitory_url.value'

# Initialize AWS infrastructure for local development
local-init: tf-init tf-setup create-ecr
	@echo "ECR repository created successfully! ECR URL:"
	@make get-ecr-url

# Helper command to tag and push Docker image to ECR
ecr-push:
	$(eval ECR_REPOSITORY_URL=$(shell cd terraform && terraform output -json | jq -r '.ECR_REPOSITORY_URLsitory_url.value'))
	aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $(ECR_REPOSITORY_URL)
	docker tag ai-summary-app:latest $(ECR_REPOSITORY_URL):latest
	docker push $(ECR_REPOSITORY_URL):latest

# Deploy all
deploy: build ecr-push tf-apply

# Sync environment variables from terraform.tfvars to .env.docker
sync-env:
	@echo "Creating .env.docker from terraform.tfvars..."
	@echo "DATABASE_URL=mysql://$(shell grep database_username terraform/terraform.tfvars | cut -d '"' -f2):$(shell grep database_password terraform/terraform.tfvars | cut -d '"' -f2)@127.0.0.1:3306/$(shell grep database_name terraform/terraform.tfvars | cut -d '"' -f2)" > .env.docker
	@echo "JWT_SECRET=$(shell grep jwt_secret terraform/terraform.tfvars | cut -d '"' -f2)" >> .env.docker
	@echo "OPENAI_API_KEY=$(shell grep openai_api_key terraform/terraform.tfvars | cut -d '"' -f2)" >> .env.docker
	@echo ".env.docker created successfully"

.PHONY: build run docker-tag push tf-init tf-setup tf-plan tf-apply tf-destroy tf-fmt create-ecr get-ecr-url local-init ecr-push deploy sync-env

