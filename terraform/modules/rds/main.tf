resource "aws_db_instance" "main" {
  allocated_storage      = 20
  storage_type           = "gp3"
  engine                 = "mysql"
  engine_version         = "8.0"
  instance_class         = "db.t3.micro"
  identifier             = "ai-summary-db"
  db_name                = var.database_name
  username               = var.database_username
  password               = var.database_password
  parameter_group_name   = "default.mysql8.0"
  db_subnet_group_name   = var.database_subnet_group_name
  vpc_security_group_ids = [var.rds_security_group_id]
  skip_final_snapshot    = true
  publicly_accessible    = true
  multi_az               = false
  
  tags = {
    Name = "ai-summary-database"
  }
}

locals {
  db_connection_string = "mysql://${var.database_username}:${var.database_password}@${aws_db_instance.main.endpoint}/${var.database_name}"
} 