using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories;

public class UserConnectionRepository : GenericRepository<UserConnection>, IUserConnectionRepository
{
    public UserConnectionRepository(ChatterDbContext context) : base(context)
    {
    }

    public async Task<UserConnection?> GetByConnectionIdAsync(string connectionId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(uc => uc.User)
            .FirstOrDefaultAsync(uc => uc.ConnectionId == connectionId, cancellationToken);
    }

    public async Task<IEnumerable<UserConnection>> GetUserActiveConnectionsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(uc => uc.UserId == userId && uc.IsActive)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<UserConnection>> GetUserConnectionsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(uc => uc.UserId == userId)
            .OrderByDescending(uc => uc.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task DisconnectAsync(string connectionId, CancellationToken cancellationToken = default)
    {
        var connection = await GetByConnectionIdAsync(connectionId, cancellationToken);
        if (connection != null)
        {
            connection.Disconnect();
        }
    }

    public async Task DisconnectAllUserConnectionsAsync(string userId, CancellationToken cancellationToken = default)
    {
        var connections = await GetUserActiveConnectionsAsync(userId, cancellationToken);
        foreach (var connection in connections)
        {
            connection.Disconnect();
        }
    }

    public async Task<bool> IsUserConnectedAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .AnyAsync(uc => uc.UserId == userId && uc.IsActive, cancellationToken);
    }

    public async Task<int> GetActiveConnectionCountAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .CountAsync(uc => uc.UserId == userId && uc.IsActive, cancellationToken);
    }

    public async Task CleanupStaleConnectionsAsync(TimeSpan staleThreshold, CancellationToken cancellationToken = default)
    {
        var cutoffTime = DateTime.UtcNow - staleThreshold;
        var staleConnections = await _dbSet
            .Where(uc => uc.IsActive && uc.CreatedAt < cutoffTime)
            .ToListAsync(cancellationToken);

        foreach (var connection in staleConnections)
        {
            connection.Disconnect();
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
