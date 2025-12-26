using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;

namespace Chatter.API.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;
        var path = context.Request.Path;
        var ip = context.Connection.RemoteIpAddress?.ToString();
        var userAgent = context.Request.Headers["User-Agent"].ToString();
        var auth = context.User?.Identity?.IsAuthenticated == true ? context.User.Identity.Name : "Anonymous";

        _logger.LogInformation("HTTP {Method} {Path} from {IP} UA:{UserAgent} Auth:{Auth}", method, path, ip, userAgent, auth);

        await _next(context);
    }
}
