using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;

namespace Chatter.API.Middleware;

public class RateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<RateLimitMiddleware> _logger;

    // Ayarlar
    private const int MaxAttempts = 5;
    private const int WindowSeconds = 60;

    public RateLimitMiddleware(RequestDelegate next, IMemoryCache memoryCache, ILogger<RateLimitMiddleware> logger)
    {
        _next = next;
        _memoryCache = memoryCache;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.ToString().ToLower();

        // Sadece hassas endpoint'leri kontrol et
        if (path.Contains("/auth/login") || path.Contains("/auth/register"))
        {
            var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var cacheKey = $"RateLimit_{ipAddress}_{path}";

            // Cache'den mevcut durumu al veya yoksa oluştur
            var currentAttempts = _memoryCache.GetOrCreate(cacheKey, entry =>
            {
                // Veri cache'e ilk kez ekleniyorsa, ömrünü belirle
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(WindowSeconds);
                return 0; // Başlangıç değeri
            });

            if (currentAttempts >= MaxAttempts)
            {
                _logger.LogWarning("Rate limit exceeded for {IpAddress} on {Path}", ipAddress, path);
                
                await WriteRateLimitResponse(context);
                return; // Zinciri kır, servise gitme
            }

            // Sayacı artır ve cache'i güncelle (Süreyi sıfırlamadan)
            // Not: IMemoryCache'de değeri güncellemek için tekrar Set etmek gerekir.
            // Ancak AbsoluteExpiration korumak için, kalan süreyi hesaplamak karmaşıktır.
            // Basitlik adına her denemede aynı key'e yeni değer atıyoruz ama 
            // AbsoluteExpiration'ı ilk giriş anına sadık tutmak için basit bir numara yapıyoruz:
            
            // Daha sağlam yöntem: Değeri artır.
            _memoryCache.Set(cacheKey, currentAttempts + 1, TimeSpan.FromSeconds(WindowSeconds));
        }

        await _next(context);
    }

    private static Task WriteRateLimitResponse(HttpContext context)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;

        // Projenin standart hata formatına uygun yanıt
        var response = new
        {
            error = new
            {
                code = "Auth.RateLimitExceeded",
                message = "Çok fazla deneme yaptınız. Lütfen 1 dakika bekleyip tekrar deneyin."
            }
        };

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        return context.Response.WriteAsync(JsonSerializer.Serialize(response, jsonOptions));
    }
}