output "aws_region" {
  description = "Region everything was created in"
  value       = var.aws_region
}

output "ecr_repository_url" {
  description = "Docker image registry. Use this as IMAGE_REPO in Jenkins."
  value       = aws_ecr_repository.app.repository_url
}

output "eks_cluster_name" {
  description = "EKS cluster name. Use with: aws eks update-kubeconfig --name <this>"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Kubernetes API endpoint"
  value       = module.eks.cluster_endpoint
}

output "efs_file_system_id" {
  description = "Put this in k8s/base/uploads-pvc.yaml as fileSystemId"
  value       = aws_efs_file_system.uploads.id
}

output "alb_controller_role_arn" {
  description = "Annotate the aws-load-balancer-controller service account with this"
  value       = module.aws_load_balancer_controller_irsa.iam_role_arn
}

output "efs_csi_role_arn" {
  description = "Annotate the efs-csi-controller-sa service account with this"
  value       = module.efs_csi_irsa.iam_role_arn
}

output "database_endpoint" {
  description = "RDS SQL Server endpoint"
  value       = aws_db_instance.sqlserver.address
}

output "database_connection_string" {
  description = "Full DATABASE_URL for the Kubernetes secret"
  value       = "sqlserver://${aws_db_instance.sqlserver.address}:1433;database=mess_db;user=${var.db_username};password=${random_password.db.result};encrypt=true;trustServerCertificate=true"
  sensitive   = true
}

output "auth_secret" {
  description = "AUTH_SECRET for the Kubernetes secret. Must be identical across all pods."
  value       = random_password.auth_secret.result
  sensitive   = true
}

output "next_steps" {
  description = "What to do after terraform apply"
  value       = <<-EOT
    1. aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}
    2. Install the AWS Load Balancer Controller and EFS CSI driver (see docs/DEVOPS.md section 5)
    3. Put ${aws_efs_file_system.uploads.id} into k8s/base/uploads-pvc.yaml
    4. terraform output -raw database_connection_string  ->  Kubernetes secret
    5. terraform output -raw auth_secret                 ->  Kubernetes secret
    6. kubectl apply -f k8s/base/
  EOT
}
