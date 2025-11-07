using Chatter.Domain.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Data;

public class ChatterDbContext : IdentityDbContext<AppUser>
{
    public ChatterDbContext(DbContextOptions<ChatterDbContext> options) : base(options)
    {
    }

    // Auth & Users
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserConnection> UserConnections => Set<UserConnection>();

    // Conversations & Messages
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ConversationParticipant> ConversationParticipants => Set<ConversationParticipant>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageAttachment> MessageAttachments => Set<MessageAttachment>();
    public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Apply all configurations from assembly
        builder.ApplyConfigurationsFromAssembly(typeof(ChatterDbContext).Assembly);
    }
}
