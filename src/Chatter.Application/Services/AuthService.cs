using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Chatter.Application.Common; // Result ve Error sınıfları burada
using Chatter.Application.DTOs.Auth;
using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Chatter.Application.Services
{
    public class AuthService : IAuthService
    {
        private readonly UserManager<AppUser> _userManager;
        private readonly IConfiguration _configuration;
        private readonly IUserRepository _userRepository;
        private readonly IRefreshTokenRepository _refreshTokenRepository;
        private readonly IUnitOfWork _unitOfWork;

        public AuthService(
            UserManager<AppUser> userManager,
            IConfiguration configuration,
            IUserRepository userRepository,
            IRefreshTokenRepository refreshTokenRepository,
            IUnitOfWork unitOfWork)
        {
            _userManager = userManager;
            _configuration = configuration;
            _userRepository = userRepository;
            _refreshTokenRepository = refreshTokenRepository;
            _unitOfWork = unitOfWork;
        }

        public async Task<Result<Guid>> RegisterAsync(RegisterRequest request)
        {
            await _unitOfWork.BeginTransactionAsync();

            try
            {
                // 1. Validasyonlar
                var existingUser = await _userRepository.GetByEmailAsync(request.Email);
                if (existingUser != null)
                {
                    return Result<Guid>.Failure(new Error("Auth.EmailExists", "Bu email adresi zaten kullanılıyor."));
                }

                var existingUsername = await _userRepository.GetByUsernameAsync(request.UserName);
                if (existingUsername != null)
                {
                    return Result<Guid>.Failure(new Error("Auth.UsernameExists", "Bu kullanıcı adı zaten kullanılıyor."));
                }

                // 2. Kullanıcı Oluşturma
                var user = new AppUser(
                    userName: request.UserName,
                    email: request.Email,
                    fullName: request.FullName ?? request.UserName
                )
                {
                    EmailConfirmed = false
                };

                var result = await _userManager.CreateAsync(user, request.Password);

                if (!result.Succeeded)
                {
                    var errorMsg = string.Join(", ", result.Errors.Select(e => e.Description));
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<Guid>.Failure(new Error("Auth.CreateFailed", $"Kullanıcı oluşturulamadı: {errorMsg}"));
                }

                // 3. Rol Atama
                await _userManager.AddToRoleAsync(user, "User");

                // Not: Register işleminde token üretmiyoruz, sadece kayıt yapıyoruz. 
                // Kullanıcı giriş yapmak için Login endpoint'ini kullanmalı.
                
                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                return Result<Guid>.Success(user.Id);
            }
            catch (Exception)
            {
                await _unitOfWork.RollbackTransactionAsync();
                return Result<Guid>.Failure(new Error("Auth.Exception", "Kayıt işlemi sırasında beklenmedik bir hata oluştu."));
            }
        }

        public async Task<Result<LoginResponse>> LoginAsync(LoginRequest request)
        {
            // Login işleminde de transaction kullanıyoruz çünkü RefreshToken kaydedeceğiz.
            await _unitOfWork.BeginTransactionAsync(); 
            try
            {
                var user = await _userRepository.GetByEmailAsync(request.Email);

                if (user == null)
                {
                    return Result<LoginResponse>.Failure(new Error("Auth.InvalidCredentials", "Kullanıcı adı veya şifre hatalı."));
                }

                var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);
                if (!isPasswordValid)
                {
                    return Result<LoginResponse>.Failure(new Error("Auth.InvalidCredentials", "Kullanıcı adı veya şifre hatalı."));
                }

                if (!user.IsActive)
                {
                    return Result<LoginResponse>.Failure(new Error("Auth.Inactive", "Hesabınız pasif durumdadır."));
                }

                // Token Üretimi
                var token = await GenerateJwtToken(user);
                var refreshToken = GenerateRefreshToken();
                
                var refreshTokenEntity = new RefreshToken(
                    userId: user.Id,
                    token: refreshToken,
                    jwtId: Guid.NewGuid().ToString(), // Normalde JWT içindeki JTI claim'inin buraya verilmesi en doğrusudur.
                    expiresAt: DateTime.UtcNow.AddDays(7),
                    createdByIp: null
                );

                await _refreshTokenRepository.AddAsync(refreshTokenEntity);

                // Kullanıcı durumu güncelle
                user.SetOnlineStatus(true); // AppUser içinde bu metodun tanımlı olduğunu varsayıyoruz

                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                var response = new LoginResponse
                {
                    UserId = user.Id.ToString(),
                    UserName = user.UserName!,
                    Email = user.Email!,
                    Token = token,
                    RefreshToken = refreshToken
                };

                return Result<LoginResponse>.Success(response);
            }
            catch (Exception ex)
            {
                await _unitOfWork.RollbackTransactionAsync();
                // Log the actual exception for debugging
                Console.WriteLine($"❌ LOGIN EXCEPTION: {ex.GetType().Name}: {ex.Message}");
                Console.WriteLine($"❌ STACK TRACE: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ INNER EXCEPTION: {ex.InnerException.Message}");
                }
                return Result<LoginResponse>.Failure(new Error("Auth.LoginFailed", $"Giriş yapılırken bir hata oluştu: {ex.Message}"));
            }
        }

        // Interface'e uygun dönüş tiplerini güncelledik
        public async Task<Result<bool>> ChangePasswordAsync(ChangePasswordRequest request, Guid userId)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(userId.ToString());
                if (user == null)
                    return Result<bool>.Failure(new Error("Auth.UserNotFound", "Kullanıcı bulunamadı."));

                var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
                if (!result.Succeeded)
                {
                    var errorMsg = string.Join(", ", result.Errors.Select(e => e.Description));
                    return Result<bool>.Failure(new Error("Auth.ChangePasswordFailed", errorMsg));
                }

                // Diğer cihazları oturumdan çıkar (token rotation güvenliği)
                await _refreshTokenRepository.RevokeUserTokensAsync(userId);
                await _unitOfWork.SaveChangesAsync();

                return Result<bool>.Success(true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ CHANGE PASSWORD EXCEPTION: {ex.Message}");
                return Result<bool>.Failure(new Error("Auth.ChangePasswordFailed", "Şifre değiştirme sırasında bir hata oluştu."));
            }
        }

        public Task<Result<bool>> ForgotPasswordAsync(ForgotPasswordRequest request)
        {
            throw new NotImplementedException();
        }

        public async Task<Result<LoginResponse>> RefreshTokenAsync(RefreshTokenRequest request, JwtPayload jwt)
        {
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                // 1. Refresh token'ı DB'den bul
                var storedToken = await _refreshTokenRepository.GetByTokenAsync(request.RefreshToken);
                if (storedToken == null)
                {
                    return Result<LoginResponse>.Failure(new Error("Auth.InvalidRefreshToken", "Geçersiz refresh token."));
                }

                // 2. Token geçerlilik kontrolü
                if (!storedToken.IsActive)
                {
                    return Result<LoginResponse>.Failure(new Error("Auth.InvalidRefreshToken", "Refresh token süresi dolmuş veya kullanılmış."));
                }

                // 3. JWT payload'daki kullanıcı ile refresh token sahibini eşleştir
                string? jtiClaim = null;
                if (jwt != null)
                {
                    if (jwt.TryGetValue("sub", out var subVal))
                        jtiClaim = subVal?.ToString();
                    else if (jwt.TryGetValue(ClaimTypes.NameIdentifier, out var nameIdVal))
                        jtiClaim = nameIdVal?.ToString();
                }

                if (jtiClaim != null && Guid.TryParse(jtiClaim, out var jwtUserId))
                {
                    if (jwtUserId != storedToken.UserId)
                    {
                        return Result<LoginResponse>.Failure(new Error("Auth.TokenMismatch", "Token eşleşmesi başarısız."));
                    }
                }

                // 4. Kullanıcıyı getir
                var user = await _userRepository.GetByIdAsync(storedToken.UserId);
                if (user == null || !user.IsActive)
                {
                    return Result<LoginResponse>.Failure(new Error("Auth.UserNotFound", "Kullanıcı bulunamadı veya hesap pasif."));
                }

                // 5. Eski token'ı kullanılmış olarak işaretle (token rotation)
                var newRefreshTokenString = GenerateRefreshToken();
                storedToken.ReplaceWith(newRefreshTokenString, null);

                // 6. Yeni refresh token oluştur
                var newRefreshTokenEntity = new RefreshToken(
                    userId: user.Id,
                    token: newRefreshTokenString,
                    jwtId: Guid.NewGuid().ToString(), // JTI
                    expiresAt: DateTime.UtcNow.AddDays(7),
                    createdByIp: null
                );
                await _refreshTokenRepository.AddAsync(newRefreshTokenEntity);

                // 7. Yeni JWT üret
                var newJwtToken = await GenerateJwtToken(user);

                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                var response = new LoginResponse
                {
                    UserId = user.Id.ToString(),
                    UserName = user.UserName!,
                    Email = user.Email!,
                    Token = newJwtToken,
                    RefreshToken = newRefreshTokenString
                };

                return Result<LoginResponse>.Success(response);
            }
            catch (Exception ex)
            {
                await _unitOfWork.RollbackTransactionAsync();
                Console.WriteLine($"❌ REFRESH TOKEN EXCEPTION: {ex.GetType().Name}: {ex.Message}");
                return Result<LoginResponse>.Failure(new Error("Auth.RefreshFailed", "Token yenileme sırasında bir hata oluştu."));
            }
        }

        // ====== Private Helper Methods ======

        private async Task<string> GenerateJwtToken(AppUser user)
        {
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var secretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY") 
                            ?? jwtSettings["SecretKey"] 
                            ?? throw new InvalidOperationException("JWT SecretKey konfigürasyonu eksik.");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var roles = await _userManager.GetRolesAsync(user);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), // Guid -> String dönüşümü
                new Claim(ClaimTypes.Name, user.UserName!),
                new Claim(ClaimTypes.Email, user.Email!),
                new Claim("FullName", user.FullName ?? ""),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(Convert.ToDouble(jwtSettings["ExpiryInMinutes"] ?? "60")),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateRefreshToken()
        {
            var randomBytes = new byte[32];
            using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            rng.GetBytes(randomBytes);
            return Convert.ToBase64String(randomBytes);
        }
    }
}