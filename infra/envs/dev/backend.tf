terraform {
  backend "s3" {
    bucket       = "gcl-devenv-045494471630"
    key          = "dev/terraform.tfstate"
    region       = "ap-southeast-2"
    use_lockfile = true
    encrypt      = true
  }
}
