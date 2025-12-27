using Chatter.Application.DTOs.Auth;
using Chatter.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Chatter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : BaseApiController // ControllerBase yerine BaseApiController
{
    private readonly IAuthService _authService;
    // ILogger business logic için kaldırıldı, kritik hataları middleware yakalar.

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// Yeni kullanıcı kaydı
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // Servis Result<Guid> dönüyor
        var result = await _authService.RegisterAsync(request);
        
        // HandleResult, başarılıysa Ok(Guid), başarısızsa BadRequest(Error) döner.
        return HandleResult(result);
    }

    /// <summary>
    /// Kullanıcı girişi
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Servis Result<LoginResponse> dönüyor
        var result = await _authService.LoginAsync(request);
        
        return HandleResult(result);
    }

    /// <summary>
    /// Şifre değiştirme (Authenticated)
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        // 1. Token'dan User ID'yi güvenli şekilde al
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            // BaseApiController yapısına uygun hata dönüşü
            return Unauthorized(new { error = new { code = "Auth.InvalidToken", message = "Geçersiz oturum bilgisi." } });
        }

        // 2. Servisi çağır (Result<bool> döner)
        var result = await _authService.ChangePasswordAsync(request, userId);

        return HandleResult(result);
    }
}