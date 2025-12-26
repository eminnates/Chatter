using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Chatter.Application.Common;
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

        public async Task<RegisterResponse> RegisterAsync(RegisterRequest request)
        {
            // Transaction başlat
            await _unitOfWork.BeginTransactionAsync();

            try
            {
                // 1. Email zaten kayıtlı mı kontrol et
                var existingUser = await _userRepository.GetByEmailAsync(request.Email);
                if (existingUser != null)
                {
                    throw new InvalidOperationException("Bu email adresi zaten kullanılıyor.");
                }

                // 2. Username zaten kayıtlı mı kontrol et
                var existingUsername = await _userRepository.GetByUsernameAsync(request.UserName);
                if (existingUsername != null)
                {
                    throw new InvalidOperationException("Bu kullanıcı adı zaten kullanılıyor.");
                }

                // 3. Yeni kullanıcı oluştur
                var user = new AppUser
                {
                    UserName = request.UserName,
                    Email = request.Email,
                    FullName = request.FullName ?? request.UserName,
                    EmailConfirmed = false,
                    IsActive = true,
                    IsOnline = false,
                    CreatedAt = DateTime.UtcNow
                };

                // 4. Identity ile kullanıcıyı kaydet
                var result = await _userManager.CreateAsync(user, request.Password);
                
                if (!result.Succeeded)
                {
                    var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                    throw new InvalidOperationException($"Kullanıcı oluşturulamadı: {errors}");
                }

                // 5. Varsayılan rol ata
                await _userManager.AddToRoleAsync(user, "User");

                // 6. JWT Token üret
                var token = await GenerateJwtToken(user);

                // 7. Refresh Token oluştur ve kaydet
                var refreshToken = GenerateRefreshToken();
                var refreshTokenEntity = new RefreshToken
                {
                    Token = refreshToken,
                    UserId = user.Id,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    CreatedAt = DateTime.UtcNow,
                    IsUsed = false,
                    IsRevoked = false
                };

                await _refreshTokenRepository.AddAsync(refreshTokenEntity);
                await _unitOfWork.SaveChangesAsync();

                // Her şey başarılıysa commit et
                await _unitOfWork.CommitTransactionAsync();

                // 8. Response döndür
                return new RegisterResponse
                {
                    UserId = user.Id,
                    UserName = user.UserName,
                    Email = user.Email,
                    FullName = user.FullName,
                    Token = token
                };
            }
            catch
            {
                // Hata durumunda rollback yap
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        public async Task<LoginResponse> LoginAsync(LoginRequest request)
        {
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                // 1. Kullanıcıyı bul (Email ile)
                var user = await _userRepository.GetByEmailAsync(request.Email);

                if (user == null)
                {
                    // Güvenlik nedeniyle detay vermiyoruz
                    throw new InvalidOperationException("Kullanıcı adı veya şifre hatalı.");
                }

                // 2. Şifreyi kontrol et
                var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);
                if (!isPasswordValid)
                {
                    throw new InvalidOperationException("Kullanıcı adı veya şifre hatalı.");
                }

                // 3. Kullanıcı aktif mi kontrol et
                if (!user.IsActive)
                {
                    throw new InvalidOperationException("Hesabınız pasif durumdadır. Lütfen yönetici ile iletişime geçin.");
                }

                // 4. JWT Token üret
                var token = await GenerateJwtToken(user);

                // 5. Refresh Token üret ve kaydet
                var refreshToken = GenerateRefreshToken();
                var refreshTokenEntity = new RefreshToken
                {
                    Token = refreshToken,
                    UserId = user.Id,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    CreatedAt = DateTime.UtcNow,
                    IsUsed = false,
                    IsRevoked = false
                };

                await _refreshTokenRepository.AddAsync(refreshTokenEntity);
                
                // 6. Kullanıcıyı online yap
                user.SetOnlineStatus(true);
                
                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                // 7. Response döndür
                return new LoginResponse
                {
                    UserId = user.Id,
                    UserName = user.UserName!,
                    Email = user.Email!,
                    Token = token,
                    RefreshToken = refreshToken
                };
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        public Task<ChangePasswordResponse> ChangePasswordAsync(ChangePasswordRequest request, Guid userId)
        {
            throw new NotImplementedException();
        }

        public Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordRequest request)
        {
            throw new NotImplementedException();
        }

        public Task<RefreshTokenResponse> RefreshTokenAsync(RefreshTokenRequest request, JwtPayload jwt)
        {
            throw new NotImplementedException();
        }

        // ====== Private Helper Methods ======

        private async Task<string> GenerateJwtToken(AppUser user)
        {
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var secretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
                ?? jwtSettings["SecretKey"]
                ?? throw new InvalidOperationException("JWT SecretKey bulunamadı.");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // Kullanıcı rollerini al
            var roles = await _userManager.GetRolesAsync(user);

            // Claims oluştur
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.UserName!),
                new Claim(ClaimTypes.Email, user.Email!),
                new Claim("FullName", user.FullName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            // Rolleri claim olarak ekle
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