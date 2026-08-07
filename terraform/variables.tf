variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "The target AWS Region for deployment"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Deployment environment namespace"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "The root password for the RDS PostgreSQL database"
}

variable "enable_read_replica" {
  type        = bool
  default     = true
  description = "Provision read-replica instance for read-heavy API scaling"
}

variable "api_image_url" {
  type        = string
  default     = "123456789012.dkr.ecr.us-east-1.amazonaws.com/arcswarm-api"
  description = "The repository URL for the API runner docker image"
}

variable "agents_image_url" {
  type        = string
  default     = "123456789012.dkr.ecr.us-east-1.amazonaws.com/arcswarm-agents"
  description = "The repository URL for the agents runner docker image"
}
