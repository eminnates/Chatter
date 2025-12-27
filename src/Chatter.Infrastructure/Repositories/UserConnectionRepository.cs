using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories;

public class UserConnectionRepository : GenericRepository<UserConnection, Guid>, IUserConnectionRepository
{
    public UserConnectionRepository(ChatterDbContext context) : base(context)
    {
    }

    // ConnectionId her zaman string'dir (SignalR ID). Değişiklik yok.
    public async Task<UserConnection?> GetByConnectionIdAsync(string connectionId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(uc => uc.User)
            .FirstOrDefaultAsync(uc => uc.ConnectionId == connectionId, cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<IEnumerable<UserConnection>> GetUserActiveConnectionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            // uc.UserId (Guid) == userId (Guid)
            .Where(uc => uc.UserId == userId && uc.IsActive)
            .ToListAsync(cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<IEnumerable<UserConnection>> GetUserConnectionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(uc => uc.UserId == userId)
            .OrderByDescending(uc => uc.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    // ConnectionId string'dir. Değişiklik yok.
    public async Task DisconnectAsync(string connectionId, CancellationToken cancellationToken = default)
    {
        var connection = await GetByConnectionIdAsync(connectionId, cancellationToken);
        if (connection != null)
        {
            connection.Disconnect();
        }
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task DisconnectAllUserConnectionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        // GetUserActiveConnectionsAsync artık Guid bekliyor, burası uyumlu oldu.
        var connections = await GetUserActiveConnectionsAsync(userId, cancellationToken);
        foreach (var connection in connections)
        {
            connection.Disconnect();
        }
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<bool> IsUserConnectedAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .AnyAsync(uc => uc.UserId == userId && uc.IsActive, cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<int> GetActiveConnectionCountAsync(Guid userId, CancellationToken cancellationToken = default)
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

        // Repository içinde SaveChanges çağırmak genelde UnitOfWork işidir ama 
        // bu özel bir temizlik job'ı olduğu için burada kalabilir.
        await _context.SaveChangesAsync(cancellationToken);
    }
}