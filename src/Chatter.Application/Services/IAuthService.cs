using Chatter.Application.DTOs.Auth;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Chatter.Application.Services
{
    public interface IAuthService
    {
        Task<RegisterResponse> RegisterAsync(RegisterRequest request);
        Task<LoginResponse> LoginAsync(LoginRequest request);
        Task<ChangePasswordResponse> ChangePasswordAsync(ChangePasswordRequest request, Guid userId);
        Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordRequest request);
        Task<RefreshTokenResponse> RefreshTokenAsync(RefreshTokenRequest request, JwtPayload jwt);

    }
}
