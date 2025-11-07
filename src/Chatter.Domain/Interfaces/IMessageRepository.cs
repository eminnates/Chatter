using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    public interface IMessageRepository : IGenericRepository<Message>
    {
        Task<Message?> GetByIdWithDetailsAsync(Guid id, CancellationToken cancellationToken = default);
        Task<IEnumerable<Message>> GetConversationMessagesAsync(
            Guid conversationId, 
            int pageNumber, 
            int pageSize, 
            CancellationToken cancellationToken = default);
        Task<IEnumerable<Message>> GetUnreadMessagesAsync(Guid conversationId, string userId, CancellationToken cancellationToken = default);
        Task<int> GetUnreadCountAsync(Guid conversationId, string userId, CancellationToken cancellationToken = default);
        Task<Message?> GetLastMessageAsync(Guid conversationId, CancellationToken cancellationToken = default);
        Task MarkMessagesAsReadAsync(Guid conversationId, string userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<Message>> SearchMessagesAsync(Guid conversationId, string searchTerm, CancellationToken cancellationToken = default);
        Task<bool> CanUserEditMessageAsync(Guid messageId, string userId, CancellationToken cancellationToken = default);
        Task<bool> CanUserDeleteMessageAsync(Guid messageId, string userId, CancellationToken cancellationToken = default);
    }
}
