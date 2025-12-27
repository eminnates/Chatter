using System.Diagnostics; // Stopwatch için gerekli

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
        // 1. Süre tutmaya başla
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            // 2. İsteği bir sonraki adıma (Controller'a) devret
            await _next(context);
        }
        finally
        {
            // 3. İstek bitti (başarılı veya hatalı), süreyi durdur
            stopwatch.Stop();

            // 4. Detayları topla
            var method = context.Request.Method;
            var path = context.Request.Path;
            var statusCode = context.Response.StatusCode;
            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            
            // User-Agent bazen boş olabilir, null check yapalım
            var userAgent = context.Request.Headers["User-Agent"].ToString();
            if (userAgent.Length > 100) userAgent = userAgent.Substring(0, 100) + "..."; // Çok uzunsa kırp

            // Kullanıcı kim?
            var user = context.User?.Identity?.IsAuthenticated == true 
                ? context.User.Identity.Name ?? "AuthenticatedUser" 
                : "Anonymous";

            // 5. Log Seviyesini Belirle (Hata varsa Warning, yoksa Info)
            var logLevel = statusCode >= 500 ? LogLevel.Error :
                           statusCode >= 400 ? LogLevel.Warning : 
                           LogLevel.Information;

            // 6. Yapısal (Structured) Loglama yap
            // Mesajın sonuna "in {Elapsed}ms" ekledik.
            _logger.Log(logLevel, 
                "HTTP {Method} {Path} responded {StatusCode} in {Elapsed:0.0000}ms. IP: {IP} User: {User}",
                method, path, statusCode, stopwatch.Elapsed.TotalMilliseconds, ip, user);
        }
    }
}