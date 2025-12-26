namespace Chatter.API.Middleware;

/// <summary>
/// Simple in-memory rate limiter for API endpoints.
/// Tracks request counts per IP address per endpoint.
/// </summary>
public class RateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitMiddleware> _logger;
    private static readonly Dictionary<string, RateLimitEntry> RequestCounts = new();
    private static readonly object LockObject = new();
    private const int MaxAttempts = 5;
    private const int WindowSeconds = 60;

    private class RateLimitEntry
    {
        public int Count { get; set; }
        public DateTime FirstRequestTime { get; set; }
    }

    public RateLimitMiddleware(RequestDelegate next, ILogger<RateLimitMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Apply rate limiting to sensitive endpoints
        var path = context.Request.Path.ToString().ToLower();
        
        if (path.Contains("/auth/login") || path.Contains("/auth/register"))
        {
            var clientId = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var key = $"{clientId}:{path}";
            
            lock (LockObject)
            {
                if (RequestCounts.TryGetValue(key, out var entry))
                {
                    // Reset if window expired
                    if ((DateTime.UtcNow - entry.FirstRequestTime).TotalSeconds > WindowSeconds)
                    {
                        entry.Count = 1;
                        entry.FirstRequestTime = DateTime.UtcNow;
                    }
                    else if (entry.Count >= MaxAttempts)
                    {
                        _logger.LogWarning($"Rate limit exceeded for {clientId} on {path}");
                        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                        context.Response.ContentType = "application/json";
                        return;
                    }
                    else
                    {
                        entry.Count++;
                    }
                }
                else
                {
                    RequestCounts[key] = new RateLimitEntry
                    {
                        Count = 1,
                        FirstRequestTime = DateTime.UtcNow
                    };
                }
            }
        }
        
        await _next(context);
    }
}
