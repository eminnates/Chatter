using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    // DÜZELTME: İsmi IUserConnectionRepository olmalı ve <UserConnection, Guid> almalı
    public interface IUserConnectionRepository : IGenericRepository<UserConnection, Guid>
    {
        Task<UserConnection?> GetByConnectionIdAsync(string connectionId, CancellationToken cancellationToken = default);
        Task<IEnumerable<UserConnection>> GetUserActiveConnectionsAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<UserConnection>> GetUserConnectionsAsync(Guid userId, CancellationToken cancellationToken = default);
        Task DisconnectAsync(string connectionId, CancellationToken cancellationToken = default);
        Task DisconnectAllUserConnectionsAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<bool> IsUserConnectedAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<int> GetActiveConnectionCountAsync(Guid userId, CancellationToken cancellationToken = default);
        Task CleanupStaleConnectionsAsync(TimeSpan staleThreshold, CancellationToken cancellationToken = default);
    }
}