output "access_aud" {
  description = "Audience tag of the power switch's Access application."
  value       = cloudflare_zero_trust_access_application.power.aud
}
