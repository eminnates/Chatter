using Chatter.Application.DTOs.Auth;
using Chatter.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Chatter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// Yeni kullanıcı kaydı
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var response = await _authService.RegisterAsync(request);
            return Ok(new
            {
                success = true,
                message = "Kullanıcı başarıyla oluşturuldu.",
                data = response
            });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Register işlemi başarısız: {Message}", ex.Message);
            return BadRequest(new
            {
                success = false,
                message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Register işlemi sırasında hata oluştu");
            return StatusCode(500, new
            {
                success = false,
                message = "Bir hata oluştu. Lütfen daha sonra tekrar deneyin."
            });
        }
    }

    /// <summary>
    /// Kullanıcı girişi
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var response = await _authService.LoginAsync(request);
            return Ok(new
            {
                success = true,
                message = "Giriş başarılı.",
                data = response
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login işlemi sırasında hata oluştu");
            return Unauthorized(new
            {
                success = false,
                message = "Kullanıcı adı veya şifre hatalı."
            });
        }
    }

    /// <summary>
    /// Şifre değiştirme (Authenticated)
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        try
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { success = false, message = "Geçersiz kullanıcı." });
            }

            var response = await _authService.ChangePasswordAsync(request, userId);
            return Ok(new
            {
                success = true,
                message = "Şifre başarıyla değiştirildi.",
                data = response
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Şifre değiştirme işlemi sırasında hata oluştu");
            return BadRequest(new
            {
                success = false,
                message = ex.Message
            });
        }
    }
}
