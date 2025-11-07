using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    public interface IUserRepository : IGenericRepository<AppUser>
    {
        Task<AppUser?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
        Task<AppUser?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default);
        Task<AppUser?> GetWithConnectionsAsync(string userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<AppUser>> GetOnlineUsersAsync(CancellationToken cancellationToken = default);
        Task<IEnumerable<AppUser>> SearchUsersAsync(string searchTerm, int pageNumber, int pageSize, CancellationToken cancellationToken = default);
        Task<bool> IsUserOnlineAsync(string userId, CancellationToken cancellationToken = default);
        Task UpdateLastSeenAsync(string userId, CancellationToken cancellationToken = default);
    }
}
