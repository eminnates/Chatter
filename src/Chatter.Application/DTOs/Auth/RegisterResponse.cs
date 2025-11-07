namespace Chatter.Application.DTOs.Auth;

public class RegisterResponse
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string Token { get; set; } = string.Empty;
}
