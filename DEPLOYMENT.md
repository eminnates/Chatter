# Chatter Backend - Production Deployment Guide

## Environment Variables Required

Production deployment için aşağıdaki environment variables'lar ayarlanmalıdır:

```bash
# Database Configuration
DB_HOST=your-postgres-host
DB_NAME=chatterdb
DB_USER=chatter_user
DB_PASSWORD=your-strong-password

# JWT Configuration (CHANGE THIS!)
JWT_SECRET_KEY=generate-a-strong-random-key-at-least-32-chars

# CORS Configuration (update with your domain)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Application Environment
ASPNETCORE_ENVIRONMENT=Production
```

## Environment-specific Configuration

### Development (appsettings.json)
- CORS: `http://localhost:5173`, `http://localhost:3000`
- Database: Local PostgreSQL with default credentials
- JWT: Placeholder secret (development only)

### Production (appsettings.Production.json)
- CORS: Specific whitelist from environment variables
- Database: Environment variable-based connection string
- JWT: Strong secret from environment variables
- HTTPS: Enforced
- Swagger: Disabled

## Security Checklist

### ✅ Implemented

1. **CORS Policy**
   - Whitelist-based instead of "AllowAll"
   - Configurable via `Cors:AllowedOrigins`

2. **Database Credentials**
   - Environment variable support
   - Not hardcoded in production config

3. **JWT Security**
   - Environment variable support for secret key
   - Token lifetime validation
   - Issuer/Audience validation

4. **Input Validation**
   - All DTOs have validation attributes
   - Email format validation
   - String length constraints
   - Required field validation

5. **Global Exception Handling**
   - Centralized exception middleware
   - No stack trace leakage to clients
   - Proper error codes (401, 400, 500)

6. **Authorization Policies**
   - Role-based access control (Admin, Moderator, User)
   - Conversation-level authorization checks
   - User membership validation

7. **HTTPS**
   - Enforced in production
   - Development mode allows HTTP

### 🔄 Rate Limiting

- Basic IP-based rate limiting for `/auth/login` and `/auth/register`
- 5 attempts per minute per IP
- Returns 429 (Too Many Requests) when limit exceeded

## Deployment Steps

### 1. Database Setup

```bash
# Create PostgreSQL database and user
createdb chatterdb
psql -U postgres -d chatterdb -c "CREATE USER chatter_user WITH ENCRYPTED PASSWORD 'your-strong-password';"
psql -U postgres -d chatterdb -c "ALTER ROLE chatter_user SET client_encoding TO 'utf8';"
psql -U postgres -d chatterdb -c "ALTER ROLE chatter_user SET default_transaction_isolation TO 'read committed';"
psql -U postgres -d chatterdb -c "GRANT ALL PRIVILEGES ON DATABASE chatterdb TO chatter_user;"

# Run migrations
dotnet ef database update --project src/Chatter.Infrastructure --startup-project src/Chatter.API
```

### 2. Build

```bash
dotnet publish -c Release -o /app/release src/Chatter.API/Chatter.API.csproj
```

### 3. Set Environment Variables

```bash
export ASPNETCORE_ENVIRONMENT=Production
export DB_HOST=your-postgres-host
export DB_NAME=chatterdb
export DB_USER=chatter_user
export DB_PASSWORD=your-strong-password
export JWT_SECRET_KEY=your-generated-secret-key
export CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 4. Run Application

```bash
cd /app/release
dotnet Chatter.API.dll
```

## Monitoring & Logging

### Application Logs

- Development: `Information` level
- Production: `Warning` level (reduced noise)

Enable structured logging with Serilog (optional):

```csharp
builder.Host.UseSerilog((context, config) =>
    config.WriteTo.Console()
          .WriteTo.File("logs/app-.txt", rollingInterval: RollingInterval.Day));
```

### Health Check

Add health check endpoint:

```csharp
app.MapHealthChecks("/health");
```

## Access Control - Whitelist Users Only

To restrict access to only desired users:

### Option 1: IP Whitelisting

Add IP whitelist middleware:

```csharp
var allowedIPs = builder.Configuration.GetSection("Security:AllowedIPs").Get<string[]>();
app.Use(async (context, next) =>
{
    var ip = context.Connection.RemoteIpAddress?.ToString();
    if (!allowedIPs.Contains(ip))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsync("Access Denied");
        return;
    }
    await next();
});
```

### Option 2: Admin Approval Required

Require admin approval before user activation:

```csharp
public class AppUser : IdentityUser
{
    public bool IsApproved { get; set; } = false;
}

// In login endpoint:
if (!user.IsApproved)
    throw new InvalidOperationException("Your account is pending approval.");
```

### Option 3: Invitation Code

Require invitation code for registration:

```csharp
[Required]
[StringLength(50)]
public string InvitationCode { get; set; }
```

## Database Backup

```bash
# Daily backup script
pg_dump -U chatter_user chatterdb > /backups/chatterdb-$(date +%Y%m%d).sql
```

## Security Headers

Consider adding middleware for additional headers:

```csharp
app.Use(async (context, next) =>
{
    context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Add("X-Frame-Options", "DENY");
    context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Add("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    await next();
});
```

## API Versioning

For future compatibility:

```csharp
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    // ...
}
```

## Rate Limiting - Advanced Configuration

For production, consider using more robust rate limiting:

```csharp
// Add AspNetCoreRateLimit package
builder.Services.AddMemoryCache();
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// Configure policies
var ipRateLimitPolicies = new RateLimitPolicy
{
    IpRules = new List<IpRateLimitPolicy>
    {
        new IpRateLimitPolicy
        {
            Ip = "*",
            Limit = 100,
            Period = "1m"
        }
    }
};
```

## Testing Production Deployment

```bash
# Test endpoint
curl -X GET https://yourdomain.com/api/user \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test rate limiting
for i in {1..10}; do curl -X POST https://yourdomain.com/api/auth/login; done
```

## Troubleshooting

### "Sequence contains no matching element"
- JWT secret key doesn't match between configurations
- Ensure `JWT_SECRET_KEY` environment variable is set

### Connection timeout to database
- Check `DB_HOST` and firewall rules
- Verify PostgreSQL is running and accessible

### CORS errors
- Update `CORS_ALLOWED_ORIGINS` with correct domain
- Ensure protocol matches (http/https)

### 401 Unauthorized on authenticated endpoints
- Token expired - regenerate token
- Invalid JWT secret key - verify environment variable

---

**Last Updated**: December 26, 2025
**Status**: Production Ready ✅
