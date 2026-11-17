output "function_url" {
  description = "The Function URL the edge forwards to. Returns 401 without a valid Access token."
  value       = aws_lambda_function_url.this.function_url
}

output "function_name" {
  description = "Name of the Lambda function."
  value       = aws_lambda_function.this.function_name
}
