using System.Net;
using System.Text.Json;
using Chatter.Domain.Common.Exceptions; // Senin Common klasöründeki exceptionlar

namespace Chatter.API.Middleware;

public class GlobalExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlerMiddleware> _logger;

    public GlobalExceptionHandlerMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlerMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = Guid.NewGuid().ToString();
        context.Items["RequestId"] = requestId;
        
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            // Don't log sensitive data
            var sanitizedPath = context.Request.Path.Value?.ToLower().Contains("password") == true 
                ? "[REDACTED]" 
                : context.Request.Path.Value;
            
            _logger.LogError(ex, "[{RequestId}] Unhandled exception on {Path}: {Message}", 
                requestId, sanitizedPath, ex.Message);
            await HandleExceptionAsync(context, ex, requestId);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception, string requestId)
    {
        context.Response.ContentType = "application/json";
        context.Response.Headers.Append("X-Request-Id", requestId);

        int statusCode;
        string errorCode;
        string message;

        switch (exception)
        {
            // 1. Validasyon Hataları (Common/Exceptions/ValidationException.cs)
            case ValidationException validationEx:
                statusCode = StatusCodes.Status400BadRequest;
                errorCode = "Validation.Error";
                message = validationEx.Message;
                break;

            // 2. Bulunamadı Hataları (Common/Exceptions/NotFoundException.cs)
            case NotFoundException notFoundEx:
                statusCode = StatusCodes.Status404NotFound;
                errorCode = "Resource.NotFound";
                message = notFoundEx.Message;
                break;

            // 3. Genel Domain Hataları (Common/Exceptions/DomainException.cs)
            case DomainException domainEx:
                statusCode = StatusCodes.Status400BadRequest;
                errorCode = "Domain.RuleViolation";
                message = domainEx.Message;
                break;

            // 4. Yetki Hataları (.NET Standard)
            case UnauthorizedAccessException:
                statusCode = StatusCodes.Status401Unauthorized;
                errorCode = "Auth.Unauthorized";
                message = "Bu işlemi yapmak için yetkiniz yok.";
                break;

            // 5. Beklenmeyen Sistem Hataları
            default:
                statusCode = StatusCodes.Status500InternalServerError;
                errorCode = "Server.InternalError";
                message = "Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.";
                break;
        }

        context.Response.StatusCode = statusCode;

        // Result Pattern formatımıza uygun JSON yanıtı oluşturuyoruz
        var response = new
        {
            error = new
            {
                code = errorCode,
                message = message
            }
        };

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        return context.Response.WriteAsync(JsonSerializer.Serialize(response, jsonOptions));
    }
}