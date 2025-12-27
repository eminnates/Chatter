using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories;

public class RefreshTokenRepository : GenericRepository<RefreshToken, Guid>, IRefreshTokenRepository
{
    public RefreshTokenRepository(ChatterDbContext context) : base(context)
    {
    }

    // Token string'dir, burası DOĞRU (Değişiklik yok)
    public async Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == token, cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<IEnumerable<RefreshToken>> GetUserActiveTokensAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            // rt.UserId (Guid) == userId (Guid)
            .Where(rt => rt.UserId == userId && !rt.IsRevoked && !rt.IsUsed && rt.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<IEnumerable<RefreshToken>> GetUserTokensAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(rt => rt.UserId == userId)
            .OrderByDescending(rt => rt.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task RevokeUserTokensAsync(Guid userId, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var tokens = await _dbSet
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync(cancellationToken);

        foreach (var token in tokens)
        {
            token.Revoke(ipAddress ?? string.Empty);
        }
    }

    // Token string'dir, burası DOĞRU (Değişiklik yok)
    public async Task RevokeTokenAsync(string token, string? ipAddress = null, CancellationToken cancellationToken = default)
    {
        var refreshToken = await GetByTokenAsync(token, cancellationToken);
        if (refreshToken != null)
        {
            refreshToken.Revoke(ipAddress ?? string.Empty);
        }
    }

    public async Task CleanupExpiredTokensAsync(CancellationToken cancellationToken = default)
    {
        var expiredTokens = await _dbSet
            .Where(rt => rt.ExpiresAt < DateTime.UtcNow)
            .ToListAsync(cancellationToken);

        _dbSet.RemoveRange(expiredTokens);
    }
}