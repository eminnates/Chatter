using Chatter.Domain.Entities;
using Chatter.Domain.Enums;
using Chatter.Domain.Interfaces;
using Chatter.Domain.Models; // UserWithChatStats burada olmalı
using Chatter.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories;

public class UserRepository : GenericRepository<AppUser, Guid>, IUserRepository
{
    private readonly UserManager<AppUser> _userManager;

    public UserRepository(ChatterDbContext context, UserManager<AppUser> userManager) : base(context)
    {
        _userManager = userManager;
    }
    // GenericRepository'den gelen GetByIdAsync zaten var ama Identity kullandığımız için eziyoruz (Override)
    public override async Task<AppUser?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        // Identity FindByIdAsync string bekler
        return await _userManager.FindByIdAsync(id.ToString());
    }

    public async Task<AppUser?> GetByEmailAsync(string email)
    {
        return await _userManager.FindByEmailAsync(email);
    }

    public async Task<AppUser?> GetByUsernameAsync(string username)
    {
        return await _userManager.FindByNameAsync(username);
    }
    public async Task<IEnumerable<AppUser>> GetAllAsync()
    {
        return await _userManager.Users.ToListAsync();
    }

    public async Task UpdateAsync(AppUser user)
    {
        await _userManager.UpdateAsync(user);
    }

    // EKSİK OLAN 2: Exists kontrolü
    public async Task<bool> ExistsAsync(Guid id)
    {
        return await _userManager.Users.AnyAsync(u => u.Id == id);
    }
    // DÜZELTME: string userId -> Guid userId
    public async Task<AppUser?> GetWithConnectionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet.Include(u => u.Connections)
                           .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
    }

    public async Task<IEnumerable<AppUser>> GetOnlineUsersAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet.Where(u => u.IsOnline)
                           .OrderByDescending(u => u.LastSeenAt)
                           .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<AppUser>> SearchUsersAsync(string searchTerm, int page, int pageSize)
    {
        return await _userManager.Users
            .Where(u => u.UserName!.Contains(searchTerm) || 
                        u.FullName.Contains(searchTerm) || 
                        u.Email!.Contains(searchTerm))
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<bool> IsUserOnlineAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet.AnyAsync(u => u.Id == userId && u.IsOnline, cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task UpdateLastSeenAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        // Guid parametresi FindAsync ile sorunsuz çalışır
        var user = await _dbSet.FindAsync(new object[] { userId }, cancellationToken);
        if (user != null)
        {
            user.UpdateLastSeen();
            // GenericRepository SaveChanges yapmaz, UnitOfWork yapar. 
            // Ancak LastSeen güncellemesi anlık olsun istersen burada SaveChanges çağırabilirsin.
        }
    }

    // DÜZELTME: string currentUserId -> Guid currentUserId
    public async Task<IEnumerable<UserWithChatStats>> GetUsersWithChatStatsAsync(Guid currentUserId)
    {
        var query = _userManager.Users
            .AsNoTracking()
            .Where(u => u.Id != currentUserId) // Guid != Guid
            .Select(u => new
            {
                User = u,
                ConversationStats = _context.Conversations
                    .Where(c => c.Type == ConversationType.OneToOne &&
                                c.Participants.Any(p => p.UserId == currentUserId) &&
                                c.Participants.Any(p => p.UserId == u.Id))
                    .Select(c => new
                    {
                        UnreadCount = c.Messages.Count(m => m.SenderId == u.Id && m.Status != MessageStatus.Read),
                        LastMessageAt = c.Messages.OrderByDescending(m => m.SentAt)
                                                  .Select(m => (DateTime?)m.SentAt)
                                                  .FirstOrDefault()
                    })
                    .FirstOrDefault()
            });

        var result = await query.ToListAsync();

        return result
            .Select(x => new UserWithChatStats
            {
                User = x.User,
                UnreadCount = x.ConversationStats?.UnreadCount ?? 0,
                LastMessageAt = x.ConversationStats?.LastMessageAt
            })
            .OrderByDescending(x => x.LastMessageAt ?? DateTime.MinValue)
            .ThenBy(x => x.User.FullName)
            .ToList();
    }
}