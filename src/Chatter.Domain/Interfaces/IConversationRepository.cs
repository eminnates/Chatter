using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    public interface IConversationRepository : IGenericRepository<Conversation>
    {
        Task<Conversation?> GetByIdWithParticipantsAsync(Guid id, CancellationToken cancellationToken = default);
        Task<Conversation?> GetByIdWithMessagesAsync(Guid id, int messageCount = 50, CancellationToken cancellationToken = default);
        Task<IEnumerable<Conversation>> GetUserConversationsAsync(string userId, CancellationToken cancellationToken = default);
        Task<Conversation?> GetOneToOneConversationAsync(string userId1, string userId2, CancellationToken cancellationToken = default);
        Task<bool> IsUserInConversationAsync(Guid conversationId, string userId, CancellationToken cancellationToken = default);
        Task<int> GetUnreadCountAsync(string userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<Conversation>> GetArchivedConversationsAsync(string userId, CancellationToken cancellationToken = default);
    }
}
