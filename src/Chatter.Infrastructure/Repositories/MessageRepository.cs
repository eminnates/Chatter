using Chatter.Domain.Entities;
using Chatter.Domain.Enums;
using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories;

public class MessageRepository : GenericRepository<Message, Guid>, IMessageRepository
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
            .Include(m => m.ReplyToMessage)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
                .ThenInclude(r => r.User)
            .Where(m => m.ConversationId == conversationId && !m.IsDeleted)
            .OrderByDescending(m => m.SentAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<IEnumerable<Message>> GetUnreadMessagesAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var participant = await _context.ConversationParticipants
            // cp.UserId (Guid) == userId (Guid) -> Tip güvenli
            .FirstOrDefaultAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId, cancellationToken);

        if (participant == null)
            return Enumerable.Empty<Message>();

        return await _dbSet
            .Where(m => m.ConversationId == conversationId &&
                       m.SenderId != userId && // Kendi mesajımız okunmamış sayılmaz
                       !m.IsDeleted &&
                       (participant.LastReadAt == null || m.SentAt > participant.LastReadAt))
            .ToListAsync(cancellationToken);
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<int> GetUnreadCountAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
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

    // DÜZELTME: string userId -> Guid userId
    public async Task MarkMessagesAsReadAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default)
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
        string searchTerm, // Arama metni string kalmalı
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

    // DÜZELTME: string userId -> Guid userId
    public async Task<bool> CanUserEditMessageAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default)
    {
        // FindAsync object array alır ama bizim ID'miz Guid. 
        // EF Core bunu otomatik map eder.
        var message = await _dbSet.FindAsync(new object[] { messageId }, cancellationToken);
        
        // message.SenderId (Guid) == userId (Guid)
        return message != null && message.SenderId == userId && message.CanBeEdited();
    }

    // DÜZELTME: string userId -> Guid userId
    public async Task<bool> CanUserDeleteMessageAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default)
    {
        var message = await _dbSet
            .Include(m => m.Conversation)
                .ThenInclude(c => c.Participants)
            .FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);

        if (message == null || !message.CanBeDeleted()) return false;

        // Kendi mesajını silebilir
        if (message.SenderId == userId) return true;

        // Veya Admin/Owner silebilir
        var participant = message.Conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        return participant?.Role is ParticipantRole.Admin or ParticipantRole.Owner;
    }
}