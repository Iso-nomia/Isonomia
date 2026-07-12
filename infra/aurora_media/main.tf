resource "aws_rds_cluster" "media" {
  cluster_identifier = "media-cmd"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  database_name      = var.database_name
  master_username    = var.master_username
  master_password    = var.master_password
}

resource "aws_rds_cluster_instance" "media" {
  count              = 1
  identifier         = "media-cmd-instance"
  cluster_identifier = aws_rds_cluster.media.id
  instance_class     = "db.serverless"
}

resource "aws_secretsmanager_secret" "db" {
  name = "media-cmd-credentials"
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.master_username
    password = var.master_password
  })
}
