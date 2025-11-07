using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    public interface IRefreshTokenRepository : IGenericRepository<RefreshToken>
    {
        Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);
        Task<IEnumerable<RefreshToken>> GetUserActiveTokensAsync(string userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<RefreshToken>> GetUserTokensAsync(string userId, CancellationToken cancellationToken = default);
        Task RevokeUserTokensAsync(string userId, string? ipAddress = null, CancellationToken cancellationToken = default);
        Task RevokeTokenAsync(string token, string? ipAddress = null, CancellationToken cancellationToken = default);
        Task CleanupExpiredTokensAsync(CancellationToken cancellationToken = default);
    }
}
