using Chatter.Domain.Entities; // <-- BU SATIRI EKLE
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Chatter.Domain.Interfaces
{
    public interface IUnitOfWork : IDisposable
    {
        IUserRepository Users { get; }
        IConversationRepository Conversations { get; }
        IMessageRepository Messages { get; }
        IRefreshTokenRepository RefreshTokens { get; }
        IUserConnectionRepository UserConnections { get; }
        ICallRepository Calls { get; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
        Task<bool> SaveChangesWithResultAsync(CancellationToken cancellationToken = default);
        
        Task BeginTransactionAsync(CancellationToken cancellationToken = default);
        Task CommitTransactionAsync(CancellationToken cancellationToken = default);
        Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
    }
}