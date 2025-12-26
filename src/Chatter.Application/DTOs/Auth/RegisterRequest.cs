using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Chatter.Application.DTOs.Auth;

public class RegisterRequest
{
    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
    [JsonPropertyName("userName")]
    public string UserName { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Password is required")]
    [StringLength(256, MinimumLength = 8, ErrorMessage = "Password must be between 8 and 256 characters")]
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
    
    [StringLength(100, ErrorMessage = "Full name cannot exceed 100 characters")]
    [JsonPropertyName("fullName")]
    public string? FullName { get; set; }
}
