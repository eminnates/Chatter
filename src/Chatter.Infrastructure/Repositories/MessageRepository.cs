using Chatter.Domain.Entities;
using Chatter.Domain.Enums;
using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories;

public class MessageRepository : GenericRepository<Message>, IMessageRepository
{
    public MessageRepository(ChatterDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Message>> GetConversationMessagesAsync(
        Guid conversationId,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(m => m.Sender)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
                .ThenInclude(r => r.User)
            .Where(m => m.ConversationId == conversationId && !m.IsDeleted)
            .OrderByDescending(m => m.SentAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<Message>> GetUnreadMessagesAsync(Guid conversationId, string userId, CancellationToken cancellationToken = default)
    {
        var participant = await _context.ConversationParticipants
            .FirstOrDefaultAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId, cancellationToken);

        if (participant == null)
            return Enumerable.Empty<Message>();

        return await _dbSet
            .Where(m => m.ConversationId == conversationId &&
                       m.SenderId != userId &&
                       !m.IsDeleted &&
                       (participant.LastReadAt == null || m.SentAt > participant.LastReadAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetUnreadCountAsync(Guid conversationId, string userId, CancellationToken cancellationToken = default)
    {
        var participant = await _context.ConversationParticipants
            .FirstOrDefaultAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId, cancellationToken);

        if (participant == null)
            return 0;

        return await _dbSet
            .CountAsync(m => m.ConversationId == conversationId &&
                            m.SenderId != userId &&
                            !m.IsDeleted &&
                            (participant.LastReadAt == null || m.SentAt > participant.LastReadAt),
                       cancellationToken);
    }

    public async Task<Message?> GetLastMessageAsync(Guid conversationId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(m => m.ConversationId == conversationId && !m.IsDeleted)
            .OrderByDescending(m => m.SentAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task MarkMessagesAsReadAsync(Guid conversationId, string userId, CancellationToken cancellationToken = default)
    {
        var messages = await _dbSet
            .Where(m => m.ConversationId == conversationId &&
                       m.SenderId != userId &&
                       !m.IsDeleted &&
                       m.Status != MessageStatus.Read)
            .ToListAsync(cancellationToken);

        foreach (var message in messages)
        {
            message.MarkAsRead();
        }

        var participant = await _context.ConversationParticipants
            .FirstOrDefaultAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId, cancellationToken);

        if (participant != null)
        {
            participant.MarkAsRead(DateTime.UtcNow);
        }
    }

    public async Task<IEnumerable<Message>> SearchMessagesAsync(
        Guid conversationId,
        string searchTerm,
        CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(m => m.Sender)
            .Where(m => m.ConversationId == conversationId &&
                       !m.IsDeleted &&
                       m.Content.Contains(searchTerm))
            .OrderByDescending(m => m.SentAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<Message?> GetByIdWithDetailsAsync(Guid messageId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(m => m.Sender)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
                .ThenInclude(r => r.User)
            .Include(m => m.ReplyToMessage)
            .FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);
    }

    public async Task<bool> CanUserEditMessageAsync(Guid messageId, string userId, CancellationToken cancellationToken = default)
    {
        var message = await _dbSet.FindAsync(new object[] { messageId }, cancellationToken);
        return message != null && message.SenderId == userId && message.CanBeEdited();
    }

    public async Task<bool> CanUserDeleteMessageAsync(Guid messageId, string userId, CancellationToken cancellationToken = default)
    {
        var message = await _dbSet
            .Include(m => m.Conversation)
                .ThenInclude(c => c.Participants)
            .FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);

        if (message == null || !message.CanBeDeleted()) return false;

        // Kendi mesajını silebilir veya Admin/Owner silebilir
        if (message.SenderId == userId) return true;

        var participant = message.Conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        return participant?.Role is ParticipantRole.Admin or ParticipantRole.Owner;
    }
}
