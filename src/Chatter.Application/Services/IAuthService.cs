using Chatter.Application.Common; // Result<T> sınıfının olduğu namespace
using Chatter.Application.DTOs.Auth;
using System.IdentityModel.Tokens.Jwt;

namespace Chatter.Application.Services
{
    public interface IAuthService
    {
        // Kayıt işleminden sonra oluşan Kullanıcı ID'sini dönmek en iyi pratiktir.
        // Artık "RegisterResponse" DTO'suna gerek kalmayabilir.
        Task<Result<Guid>> RegisterAsync(RegisterRequest request);

        // Giriş başarılıysa Token verisini içeren LoginResponse döner.
        // Hata varsa Result.Failure döner.
        Task<Result<LoginResponse>> LoginAsync(LoginRequest request);

        // Şifre değişimi sadece başarılı/başarısız bilgisidir.
        // Özel bir Response DTO yerine bool dönebiliriz.
        Task<Result<bool>> ChangePasswordAsync(ChangePasswordRequest request, Guid userId);

        // Şifre unuttum genelde void bir işlemdir (mail atar), bool yeterlidir.
        Task<Result<bool>> ForgotPasswordAsync(ForgotPasswordRequest request);

        // Token yenileme de Login gibi Token verisi döner.
        Task<Result<LoginResponse>> RefreshTokenAsync(RefreshTokenRequest request, JwtPayload jwt);
    }
}