# Illustration of the Terraform standalone install. The output is scripted by fake-deploy.sh,
# not taken from a real account. Rerun from this folder with: vhs deploy.tape
Output deploy.gif

Require bash

Set Shell bash
Set FontSize 15
Set Width 1000
Set Height 620
Set Padding 20
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"

Hide
Type "source ./fake-deploy.sh && clear"
Enter
Show

Sleep 500ms
Type "cd examples/terraform-standalone"
Enter
Sleep 400ms
Type "cp terraform.tfvars.example terraform.tfvars   # fill it in"
Enter
Sleep 400ms
Type "export CLOUDFLARE_API_TOKEN=..."
Enter
Sleep 400ms
Type "terraform init"
Enter
Sleep 1.5s
Type "terraform apply"
Enter
Sleep 1.5s
Type "yes"
Enter
Sleep 9s
