using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    public interface ICallRepository : IGenericRepository<Call, Guid>
    {
        Task<Call?> GetCallWithDetailsAsync(Guid callId, CancellationToken cancellationToken = default);
        Task<IEnumerable<Call>> GetCallHistoryAsync(Guid userId, int pageNumber, int pageSize, CancellationToken cancellationToken = default);
        Task<Call?> GetActiveCallByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<Call>> GetCallsByConversationIdAsync(Guid conversationId, CancellationToken cancellationToken = default);
    }
}
