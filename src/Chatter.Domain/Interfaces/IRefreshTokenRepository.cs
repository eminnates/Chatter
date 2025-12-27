using Chatter.Domain.Entities;

namespace Chatter.Domain.Interfaces
{
    // DÜZELTME: <RefreshToken, Guid>
    public interface IRefreshTokenRepository : IGenericRepository<RefreshToken, Guid>
    {
        Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);
        Task<IEnumerable<RefreshToken>> GetUserActiveTokensAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<IEnumerable<RefreshToken>> GetUserTokensAsync(Guid userId, CancellationToken cancellationToken = default);
        Task RevokeUserTokensAsync(Guid userId, string? ipAddress = null, CancellationToken cancellationToken = default);
        Task RevokeTokenAsync(string token, string? ipAddress = null, CancellationToken cancellationToken = default);
        Task CleanupExpiredTokensAsync(CancellationToken cancellationToken = default);
    }
}