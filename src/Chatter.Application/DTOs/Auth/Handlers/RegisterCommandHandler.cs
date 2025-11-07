using Chatter.Domain.Entities;
using Chatter.Application.DTOs.Auth.Commands;
using Chatter.Application.DTOs.Auth;
using MediatR;
using Microsoft.AspNetCore.Identity;
using System.Threading;
using System.Threading.Tasks;

namespace Chatter.Application.DTOs.Auth.Handlers
{
    public class RegisterCommandHandler : IRequestHandler<RegisterCommand, RegisterResponse>
    {
        private readonly UserManager<AppUser> _userManager;
        public RegisterCommandHandler()
        {
        }

        public Task<RegisterResponse> Handle(RegisterCommand request, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }
    }
}
