using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    // DÜZELTME: İsmi IMessageRepository olmalı ve <Message, Guid> almalı
    public interface IMessageRepository : IGenericRepository<Message, Guid>
    {
        Task<Message?> GetByIdWithDetailsAsync(Guid id, CancellationToken cancellationToken = default);
        Task<IEnumerable<Message>> GetConversationMessagesAsync(Guid conversationId, int pageNumber, int pageSize, CancellationToken cancellationToken = default);
        Task<IEnumerable<Message>> GetUnreadMessagesAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
        Task<int> GetUnreadCountAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
        Task<Message?> GetLastMessageAsync(Guid conversationId, CancellationToken cancellationToken = default);
        Task MarkMessagesAsReadAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<Message>> SearchMessagesAsync(Guid conversationId, string searchTerm, CancellationToken cancellationToken = default);
        Task<bool> CanUserEditMessageAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default);
        Task<bool> CanUserDeleteMessageAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default);
    }
}