using Chatter.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Chatter.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Services
        services.AddScoped<IAuthService, AuthService>();

        return services;
    }
}
