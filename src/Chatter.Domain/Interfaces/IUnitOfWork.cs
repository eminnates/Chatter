namespace Chatter.Domain.Interfaces
{
    public interface IUnitOfWork : IDisposable
    {
        // Repositories
        IUserRepository Users { get; }
        IConversationRepository Conversations { get; }
        IMessageRepository Messages { get; }
        IRefreshTokenRepository RefreshTokens { get; }
        IUserConnectionRepository UserConnections { get; }

        // Save changes
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
        Task<bool> SaveChangesWithResultAsync(CancellationToken cancellationToken = default);
        
        // Transaction
        Task BeginTransactionAsync(CancellationToken cancellationToken = default);
        Task CommitTransactionAsync(CancellationToken cancellationToken = default);
        Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
    }
}
