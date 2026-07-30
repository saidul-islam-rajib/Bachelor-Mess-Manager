output "server_public_ip" {
  description = "Elastic IP of the k3s node"
  value       = aws_eip.server.public_ip
}

output "app_url" {
  description = "Open this once the app is deployed"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_eip.server.public_ip}.nip.io"
}

output "ingress_host" {
  description = "Put this in the Ingress host field"
  value       = var.domain_name != "" ? var.domain_name : "${aws_eip.server.public_ip}.nip.io"
}

output "ssh_command" {
  description = "Connect to the server"
  value = var.public_key_path == "" ? "ssh -i ${path.module}/${local.name}-key.pem ubuntu@${aws_eip.server.public_ip}" : "ssh ubuntu@${aws_eip.server.public_ip}"
}

output "fetch_kubeconfig" {
  description = "Run this locally to drive the cluster with kubectl"
  value = var.public_key_path == "" ? "scp -i ${path.module}/${local.name}-key.pem ubuntu@${aws_eip.server.public_ip}:~/.kube/config ~/.kube/bachelor-point.yaml" : "scp ubuntu@${aws_eip.server.public_ip}:~/.kube/config ~/.kube/bachelor-point.yaml"
}

output "database_endpoint" {
  value = aws_db_instance.sqlserver.address
}

output "database_url" {
  description = "Already injected into the Kubernetes secret on the server"
  value       = local.database_url
  sensitive   = true
}

output "auth_secret" {
  description = "Already injected into the Kubernetes secret on the server"
  value       = random_password.auth_secret.result
  sensitive   = true
}

output "admin_email" {
  value = var.admin_email
}

output "admin_password" {
  description = "Sign in with this. Change it after the first login."
  value       = local.admin_password
  sensitive   = true
}

output "estimated_monthly_cost" {
  description = "What this actually costs"
  value = var.instance_type == "t3.micro" ? "USD 0.00 for the first 12 months (EC2 t3.micro 750h + RDS db.t3.micro 750h + 30GB EBS + 20GB RDS storage are all free tier). After 12 months roughly USD 20." : "About USD 15/month (${var.instance_type} is not free-tier eligible). RDS and storage remain free for 12 months."
}

output "next_steps" {
  value = <<-EOT

    1. Wait about 4 minutes for the server to finish installing k3s, then:
         ${var.public_key_path == "" ? "ssh -i ${path.module}/${local.name}-key.pem" : "ssh"} ubuntu@${aws_eip.server.public_ip} 'cat /var/log/bootstrap.log | tail -20'

    2. Fetch the kubeconfig so kubectl works from your laptop:
         ${var.public_key_path == "" ? "scp -i ${path.module}/${local.name}-key.pem" : "scp"} ubuntu@${aws_eip.server.public_ip}:~/.kube/config ~/.kube/bachelor-point.yaml
         export KUBECONFIG=~/.kube/bachelor-point.yaml
         kubectl get nodes

    3. Deploy the application:
         ./scripts/deploy-free-tier.sh ${aws_eip.server.public_ip}

    4. Open:
         ${var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_eip.server.public_ip}.nip.io"}

    Admin sign-in: ${var.admin_email}
    Password:      terraform output -raw admin_password
  EOT
}
