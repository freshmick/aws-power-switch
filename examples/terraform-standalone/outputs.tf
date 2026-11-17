output "power_switch_url" {
  description = "Where to open the power switch."
  value       = "https://${var.power_hostname}"
}

output "function_url" {
  description = "The Lambda's Function URL. Returns 401 without a valid Access token."
  value       = module.power_switch.function_url
}
