using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories;

public class UserRepository : GenericRepository<AppUser>, IUserRepository
{
    public UserRepository(ChatterDbContext context) : base(context)
    {
    }

    public async Task<AppUser?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
    }

    public async Task<AppUser?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .FirstOrDefaultAsync(u => u.UserName == username, cancellationToken);
    }

    public async Task<AppUser?> GetWithConnectionsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(u => u.Connections)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
    }

    public async Task<IEnumerable<AppUser>> GetOnlineUsersAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(u => u.IsOnline)
            .OrderByDescending(u => u.LastSeenAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<AppUser>> SearchUsersAsync(
        string searchTerm,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(u =>
                u.UserName!.Contains(searchTerm) ||
                u.FullName.Contains(searchTerm) ||
                u.Email!.Contains(searchTerm))
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> IsUserOnlineAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .AnyAsync(u => u.Id == userId && u.IsOnline, cancellationToken);
    }

    public async Task UpdateLastSeenAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _dbSet.FindAsync(new object[] { userId }, cancellationToken);
        if (user != null)
        {
            user.UpdateLastSeen();
        }
    }
}
