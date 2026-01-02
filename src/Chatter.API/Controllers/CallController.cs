using Chatter.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Chatter.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CallController : BaseApiController
    {
        private readonly ICallService _callService;

        public CallController(ICallService callService)
        {
            _callService = callService;
        }

        /// <summary>
        /// Get call history for the current user
        /// </summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetCallHistory([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { error = new { code = "Auth.InvalidToken", message = "Invalid session." } });
            }

            var result = await _callService.GetCallHistoryAsync(userId, pageNumber, pageSize);
            return HandleResult(result);
        }

        /// <summary>
        /// Get active call for the current user
        /// </summary>
        [HttpGet("active")]
        public async Task<IActionResult> GetActiveCall()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { error = new { code = "Auth.InvalidToken", message = "Invalid session." } });
            }

            var result = await _callService.GetActiveCallByUserIdAsync(userId);
            return HandleResult(result);
        }

        /// <summary>
        /// Get call details by ID
        /// </summary>
        [HttpGet("{callId}")]
        public async Task<IActionResult> GetCallById(Guid callId)
        {
            var result = await _callService.GetCallByIdAsync(callId);
            return HandleResult(result);
        }
    }
}
