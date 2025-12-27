using Chatter.Application.DTOs.Users;
using Chatter.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Chatter.API.Controllers;

[Authorize]
public class UserController : BaseApiController // ControllerBase yerine BaseApiController
{
    private readonly IUserService _userService;

    public UserController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllUsers()
    {
        // 1. Token'dan ID'yi al (Opsiyonel olabilir, null gidebilir)
        Guid? currentUserId = null;
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!string.IsNullOrEmpty(userIdClaim) && Guid.TryParse(userIdClaim, out var parsedId))
        {
            currentUserId = parsedId;
        }

        // 2. Servisi çağır (Result<IEnumerable<UserDto>> döner)
        var result = await _userService.GetAllUsersAsync(currentUserId);

        // 3. Tek satırda standart yanıt dön
        return HandleResult(result);
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchUsers([FromQuery] string q)
    {
        var result = await _userService.SearchUsersAsync(q);
        
        return HandleResult(result);
    }
}