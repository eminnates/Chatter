using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    // HATA: IGenericRepository<Conversation>
    // DÜZELTME: IGenericRepository<Conversation, Guid>
    public interface IConversationRepository : IGenericRepository<Conversation, Guid>
    {
        Task<Conversation?> GetByIdWithParticipantsAsync(Guid id, CancellationToken cancellationToken = default);
        Task<Conversation?> GetByIdWithMessagesAsync(Guid id, int messageCount = 50, CancellationToken cancellationToken = default);
        Task<IEnumerable<Conversation>> GetUserConversationsAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<Conversation?> GetOneToOneConversationAsync(Guid userId1, Guid userId2, CancellationToken cancellationToken = default);
        Task<bool> IsUserInConversationAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
        Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<Conversation>> GetArchivedConversationsAsync(Guid userId, CancellationToken cancellationToken = default);
    }
}