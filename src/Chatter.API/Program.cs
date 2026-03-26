using Chatter.Application;
using Chatter.Infrastructure;
using Chatter.API.Hubs;
using Chatter.API.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using DotNetEnv;
using Chatter.Domain.Entities; // <-- BUNU EKLEDİK (AppRole için şart)
using Microsoft.EntityFrameworkCore;
using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;

var builder = WebApplication.CreateBuilder(args);

// Allow all hosts (required for Render and other cloud platforms)
builder.WebHost.ConfigureKestrel(options =>
{
    options.AllowSynchronousIO = true;
    options.Limits.MaxRequestBodySize = 50 * 1024 * 1024; // 50MB - video upload desteği
});

// Add detailed logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Logging.SetMinimumLevel(LogLevel.Information);

// Load environment variables from .env file if it exists
if (File.Exists(".env"))
{
    DotNetEnv.Env.Load();
}

// Override configuration with environment variables
builder.Configuration.AddEnvironmentVariables();

// Response Compression
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[] 
    { 
        "application/json",
        "text/plain",
        "text/html"
    });
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

// Servisi ekle
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

// SignalR configuration
var signalRBuilder = builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 64 * 1024; // 64KB max message
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60); // Increased for mobile networks
    options.MaximumParallelInvocationsPerClient = 1; // Backpressure: prevent client from flooding hub
    options.StreamBufferCapacity = 20; // Backpressure: limit buffered stream items for slow clients
}).AddMessagePackProtocol(options =>
{
    options.SerializerOptions = MessagePack.MessagePackSerializerOptions.Standard
        .WithResolver(MessagePack.Resolvers.CompositeResolver.Create(
            MessagePack.Resolvers.ContractlessStandardResolverAllowPrivate.Instance,
            MessagePack.Resolvers.StandardResolver.Instance
        ));
});

// Redis backplane for horizontal scaling.
// When REDIS_URL is set, SignalR uses Redis pub/sub to sync messages across instances.
// Without this, each server instance has its own isolated set of connections/groups.
var redisUrl = Environment.GetEnvironmentVariable("REDIS_URL");
if (!string.IsNullOrEmpty(redisUrl))
{
    signalRBuilder.AddStackExchangeRedis(redisUrl, options =>
    {
        options.Configuration.ChannelPrefix = StackExchange.Redis.RedisChannel.Literal("Chatter");
    });
    Console.WriteLine("✅ SignalR Redis backplane enabled");
}

builder.Services.AddMemoryCache();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS - Allow web, Electron, mobile (Capacitor), and Vercel
var corsOriginsEnv = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS");
var corsOrigins = new List<string>();

if (!string.IsNullOrEmpty(corsOriginsEnv))
{
    corsOrigins.AddRange(corsOriginsEnv.Split(","));
}
else
{
    // Default origins for development
    corsOrigins.Add("http://localhost:5173");
    corsOrigins.Add("http://localhost:3000");
}

// Add Capacitor origins for mobile
corsOrigins.Add("capacitor://localhost");
corsOrigins.Add("http://localhost");
corsOrigins.Add("ionic://localhost");
corsOrigins.Add("http://192.168.1.1");

// Add Vercel production and preview domains
corsOrigins.Add("https://chatter-seven-pied.vercel.app");
corsOrigins.Add("https://*.vercel.app");

// Production CORS uyarısı (hata fırlatmak yerine log)
if (builder.Environment.IsProduction() && corsOriginsEnv == null)
{
    Console.WriteLine("⚠️  WARNING: CORS_ALLOWED_ORIGINS not configured. Using default origins.");
    Console.WriteLine("   Set CORS_ALLOWED_ORIGINS environment variable for production!");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy => policy
            .SetIsOriginAllowed(origin =>
            {
                // Fast origin check without Console.WriteLine on every request.
                // Console.WriteLine is synchronous I/O — it blocks the thread on every CORS check.
                return origin.StartsWith("http://localhost") ||
                       origin.StartsWith("https://localhost") ||
                       origin.StartsWith("http://tauri.localhost") ||
                       origin.StartsWith("https://tauri.localhost") ||
                       origin == "tauri://localhost" ||
                       origin.StartsWith("capacitor://") ||
                       origin.StartsWith("ionic://") ||
                       origin.StartsWith("http://192.168.") ||
                       origin.StartsWith("http://10.0.") ||
                       origin.EndsWith(".vercel.app") ||
                       origin.EndsWith(".ngrok-free.dev") ||
                       origin.EndsWith(".ngrok-free.app") ||
                       origin.EndsWith(".ngrok.io") ||
                       corsOrigins.Contains(origin);
            })
            .AllowAnyMethod()
            .AllowCredentials()
            .WithHeaders("Authorization", "Content-Type", "ngrok-skip-browser-warning", "x-requested-with", "origin", "accept", "user-agent")
            .WithExposedHeaders("*")
    );
});

// Build connection string from environment variables
var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
var dbName = Environment.GetEnvironmentVariable("DB_NAME") ?? "chatterdb";
var dbUser = Environment.GetEnvironmentVariable("DB_USER") ?? "chatter";
var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? "chatter123";
var connectionString = $"Host={dbHost};Database={dbName};Username={dbUser};Password={dbPassword}";

// Update configuration with the built connection string
builder.Configuration["ConnectionStrings:DefaultConnection"] = connectionString;

// Add Application Layer (Services)
// Register Presence Tracker
builder.Services.AddSingleton<Chatter.API.Services.PresenceTracker>();
builder.Services.AddHostedService<Chatter.API.Services.PresenceAuditLogService>();

// Register Push Notification Background Queue (decouples Firebase from hub methods)
builder.Services.AddSingleton<Chatter.API.Services.PushNotificationQueue>();
builder.Services.AddHostedService<Chatter.API.Services.PushNotificationBackgroundService>();

// Hub rate limiting filter (protects WebSocket methods from spam/flooding)
builder.Services.AddSingleton<Microsoft.AspNetCore.SignalR.IHubFilter, Chatter.API.Filters.HubRateLimitFilter>();

builder.Services.AddApplication();

// Add Infrastructure (DbContext, Identity, Repositories, UnitOfWork)
builder.Services.AddInfrastructure(builder.Configuration);

// JWT - Read from environment
var secretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY") 
    ?? "YourSuperSecretKeyThatIsAtLeast32CharactersLongChangeInProduction!";
var issuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "ChatterAPI";
var audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "ChatterClient";

// Add authorization policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));
    
    options.AddPolicy("ModeratorOrAdmin", policy =>
        policy.RequireRole("Admin", "Moderator"));
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = issuer,
        ValidAudience = audience,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(secretKey)),
        ClockSkew = TimeSpan.FromMinutes(5)
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/chat"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

var app = builder.Build();

// Auto-migration: Create database tables
using (var scope = app.Services.CreateScope())
{
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<Chatter.Infrastructure.Data.ChatterDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        
        logger.LogInformation("🔄 Checking database migrations...");
        
        // Migration'ları uygula
        await dbContext.Database.MigrateAsync();
        
        logger.LogInformation("✅ Database migrations completed successfully!");
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "❌ An error occurred while migrating the database.");
        throw; // Production'da hata fırlatıp container'ı restart yapsın
    }
}

// --- SEED ROLES (DÜZELTİLEN KISIM) ---
using (var scope = app.Services.CreateScope())
{
    // HATA BURADAYDI: RoleManager<IdentityRole> yerine RoleManager<AppRole> yaptık.
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
    var roles = new[] { "User", "Admin", "Moderator" };
    
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            // HATA BURADAYDI: new IdentityRole(role) yerine new AppRole { Name = role } yaptık.
            await roleManager.CreateAsync(new AppRole { Name = role });
        }
    }
}
// -------------------------------------

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // Production: Allow Swagger and use HTTPS
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseHttpsRedirection();
}

// Configure forwarded headers for reverse proxy (Render, etc.)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | 
                       Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
});

// Response Compression - must come before CORS
app.UseResponseCompression();

// ⚠️ CORS MUST come BEFORE exception handler and other middleware
// so that CORS headers are included even in error responses (400, 500, etc.)
app.UseCors("AllowAll");

// Security headers
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});

// Static files with aggressive caching (uploaded files have unique URLs and never change)
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "public,max-age=604800,immutable");
    }
});
// Add global exception handler middleware
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();

// Add request logging middleware
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.Run();