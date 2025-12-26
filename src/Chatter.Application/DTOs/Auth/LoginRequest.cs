using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Chatter.Application.DTOs.Auth;

public class LoginRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Password is required")]
    [StringLength(256, MinimumLength = 8, ErrorMessage = "Password must be between 8 and 256 characters")]
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}
