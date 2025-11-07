using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Storage;

namespace Chatter.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly ChatterDbContext _context;
    private IDbContextTransaction? _transaction;

    // Lazy initialization for repositories
    private IUserRepository? _users;
    private IConversationRepository? _conversations;
    private IMessageRepository? _messages;
    private IRefreshTokenRepository? _refreshTokens;
    private IUserConnectionRepository? _userConnections;

    public UnitOfWork(ChatterDbContext context)
    {
        _context = context;
    }

    public IUserRepository Users
    {
        get
        {
            _users ??= new UserRepository(_context);
            return _users;
        }
    }

    public IConversationRepository Conversations
    {
        get
        {
            _conversations ??= new ConversationRepository(_context);
            return _conversations;
        }
    }

    public IMessageRepository Messages
    {
        get
        {
            _messages ??= new MessageRepository(_context);
            return _messages;
        }
    }

    public IRefreshTokenRepository RefreshTokens
    {
        get
        {
            _refreshTokens ??= new RefreshTokenRepository(_context);
            return _refreshTokens;
        }
    }

    public IUserConnectionRepository UserConnections
    {
        get
        {
            _userConnections ??= new UserConnectionRepository(_context);
            return _userConnections;
        }
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> SaveChangesWithResultAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SaveChangesAsync(cancellationToken) > 0;
    }

    public async Task BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        _transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
            if (_transaction != null)
            {
                await _transaction.CommitAsync(cancellationToken);
            }
        }
        catch
        {
            await RollbackTransactionAsync(cancellationToken);
            throw;
        }
        finally
        {
            if (_transaction != null)
            {
                await _transaction.DisposeAsync();
                _transaction = null;
            }
        }
    }

    public async Task RollbackTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync(cancellationToken);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _context.Dispose();
    }
}
