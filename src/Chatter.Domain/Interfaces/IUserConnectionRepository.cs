using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    public interface IUserConnectionRepository : IGenericRepository<UserConnection>
    {
        Task<UserConnection?> GetByConnectionIdAsync(string connectionId, CancellationToken cancellationToken = default);
        Task<IEnumerable<UserConnection>> GetUserActiveConnectionsAsync(string userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<UserConnection>> GetUserConnectionsAsync(string userId, CancellationToken cancellationToken = default);
        Task DisconnectAsync(string connectionId, CancellationToken cancellationToken = default);
        Task DisconnectAllUserConnectionsAsync(string userId, CancellationToken cancellationToken = default);
        Task<bool> IsUserConnectedAsync(string userId, CancellationToken cancellationToken = default);
        Task<int> GetActiveConnectionCountAsync(string userId, CancellationToken cancellationToken = default);
        Task CleanupStaleConnectionsAsync(TimeSpan staleThreshold, CancellationToken cancellationToken = default);
    }
}
