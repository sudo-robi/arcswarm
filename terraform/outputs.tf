output "vpc_id" {
  value       = aws_vpc.main.id
  description = "The ID of the generated VPC network"
}

output "load_balancer_dns" {
  value       = aws_lb.main.dns_name
  description = "The public DNS endpoints for user traffic and API routing"
}

output "primary_db_endpoint" {
  value       = aws_db_instance.primary.endpoint
  description = "The connection endpoint for the write-primary database instance"
}

output "read_replica_endpoint" {
  value       = length(aws_db_instance.replica) > 0 ? aws_db_instance.replica[0].endpoint : "None"
  description = "The connection endpoint for read-replica database operations"
}

output "redis_endpoint" {
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
  description = "The connection endpoint for Redis caching/queue operations"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "The name of the deployed ECS Fargate cluster"
}
