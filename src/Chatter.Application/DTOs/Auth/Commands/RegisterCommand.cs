using MediatR;


namespace Chatter.Application.DTOs.Auth.Commands
{
    public class RegisterCommand : IRequest<RegisterResponse>
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? FullName { get; set; }
    }
}
