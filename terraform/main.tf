terraform {
  required_version = ">= 1.0.0"
  required_providers {
    railway = {
      source  = "railwayapp/railway"
      version = "~> 1.0.0"
    }
  }
}

provider "railway" {
  token = var.railway_token
}

variable "railway_token" {
  type      = string
  sensitive = true
}

variable "environment" {
  type    = string
  default = "production"
}

resource "railway_project" "arcswarm" {
  name = "arcswarm-${var.environment}"
}

resource "railway_service" "api" {
  project_id = railway_project.arcswarm.id
  name       = "arcswarm-api"
}

resource "railway_service" "agents" {
  project_id = railway_project.arcswarm.id
  name       = "arcswarm-agents"
}

resource "railway_domain" "api" {
  project_id = railway_project.arcswarm.id
  service_id = railway_service.api.id
  name       = "api.arcswarm.xyz"
}

output "api_url" {
  value = railway_domain.api.name
}
