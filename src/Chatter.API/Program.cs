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
using Microsoft.EntityFrameworkCore; // 🚀 Migration için gerekli

var builder = WebApplication.CreateBuilder(args);

// Allow all hosts (required for Render and other cloud platforms)
builder.WebHost.ConfigureKestrel(options =>
{
    options.AllowSynchronousIO = true;
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
// Servisi ekle
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);
builder.Services.AddSignalR();
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
corsOrigins.Add("https://chatter-seven-pied.vercel.app/");
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
                // Log the origin for debugging
                Console.WriteLine($"🔍 CORS request from origin: {origin}");
                
                if (origin.StartsWith("http://localhost") || 
                    origin.StartsWith("https://localhost") ||
                    origin.StartsWith("capacitor://") ||
                    origin.StartsWith("ionic://") ||
                    origin.StartsWith("http://192.168.") ||
                    origin.StartsWith("http://10.0.") ||
                    origin.EndsWith(".vercel.app") ||
                    origin.Contains("vercel.app") ||
                    origin.Contains("ngrok") ||
                    origin.EndsWith(".ngrok-free.dev") ||
                    origin.EndsWith(".ngrok-free.app") ||
                    origin.EndsWith(".ngrok.io") ||
                    origin == "https://chatter-seven-pied.vercel.app/")
                {
                    Console.WriteLine($"✅ CORS allowed for: {origin}");
                    return true;
                }
                
                var isAllowed = corsOrigins.Contains(origin);
                if (isAllowed)
                {
                    Console.WriteLine($"✅ CORS allowed (from config): {origin}");
                }
                else
                {
                    Console.WriteLine($"❌ CORS blocked: {origin}");
                }
                return isAllowed;
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

// 🚀 AUTO-MIGRATION: Database tablolarını otomatik oluştur (Production için)
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

app.UseStaticFiles();
// Add global exception handler middleware
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();

// Add request logging middleware
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.Run();