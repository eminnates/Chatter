using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories;

public class ConversationRepository : GenericRepository<Conversation>, IConversationRepository
{
    public ConversationRepository(ChatterDbContext context) : base(context)
    {
    }

    public async Task<Conversation?> GetByIdWithParticipantsAsync(Guid conversationId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.Participants)
                .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == conversationId, cancellationToken);
    }

    public async Task<Conversation?> GetByIdWithMessagesAsync(Guid conversationId, int messageCount = 50, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.Messages.OrderByDescending(m => m.SentAt).Take(messageCount))
                .ThenInclude(m => m.Sender)
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == conversationId, cancellationToken);
    }

    public async Task<IEnumerable<Conversation>> GetUserConversationsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.Participants)
                .ThenInclude(p => p.User)
            .Include(c => c.LastMessage)
            .Where(c => c.Participants.Any(p => p.UserId == userId && p.IsActive))
            .OrderByDescending(c => c.LastMessage != null ? c.LastMessage.SentAt : c.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<Conversation?> GetOneToOneConversationAsync(string userId1, string userId2, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.Participants)
            .Where(c => c.Type == Domain.Enums.ConversationType.OneToOne &&
                       c.Participants.Any(p => p.UserId == userId1) &&
                       c.Participants.Any(p => p.UserId == userId2))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<bool> IsUserInConversationAsync(Guid conversationId, string userId, CancellationToken cancellationToken = default)
    {
        return await _context.ConversationParticipants
            .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId && cp.IsActive, cancellationToken);
    }

    public async Task<int> GetUnreadCountAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _context.ConversationParticipants
            .Where(cp => cp.UserId == userId && cp.IsActive)
            .SumAsync(cp => cp.UnreadCount, cancellationToken);
    }

    public async Task<IEnumerable<Conversation>> GetArchivedConversationsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.Participants)
                .ThenInclude(p => p.User)
            .Include(c => c.LastMessage)
            .Where(c => c.Participants.Any(p => p.UserId == userId && p.IsActive) && !c.IsActive)
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync(cancellationToken);
    }
}
