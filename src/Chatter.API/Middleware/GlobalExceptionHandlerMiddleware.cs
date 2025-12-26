using Microsoft.AspNetCore.Mvc;
using System.Net;

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
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var response = new ProblemDetails
        {
            Title = "An error occurred",
            Status = StatusCodes.Status500InternalServerError,
        };

        switch (exception)
        {
            case UnauthorizedAccessException:
                response.Status = StatusCodes.Status401Unauthorized;
                response.Title = "Unauthorized";
                response.Detail = "You do not have permission to access this resource.";
                break;

            case InvalidOperationException:
                response.Status = StatusCodes.Status400BadRequest;
                response.Title = "Invalid Operation";
                response.Detail = exception.Message;
                break;

            case ArgumentException:
                response.Status = StatusCodes.Status400BadRequest;
                response.Title = "Invalid Argument";
                response.Detail = exception.Message;
                break;

            default:
                response.Status = StatusCodes.Status500InternalServerError;
                response.Title = "Internal Server Error";
                response.Detail = "An unexpected error occurred. Please try again later.";
                break;
        }

        context.Response.StatusCode = response.Status ?? StatusCodes.Status500InternalServerError;

        return context.Response.WriteAsJsonAsync(new
        {
            success = false,
            message = response.Title,
            detail = response.Detail,
            statusCode = response.Status
        });
    }
}
