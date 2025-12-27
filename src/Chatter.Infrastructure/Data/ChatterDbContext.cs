using Chatter.Domain.Entities;
using Microsoft.AspNetCore.Identity; // IdentityRole için gerekli
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Data;

// DEĞİŞİKLİK BURADA:
// 1. AppUser: Senin kullanıcı sınıfın
// 2. IdentityRole<Guid>: Rollerin de ID'si Guid olsun
// 3. Guid: Primary Key tipi
public class ChatterDbContext : IdentityDbContext<AppUser, AppRole, Guid>
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
        
        // Postgres için Guid üretimi (uuid-ossp) veya tablo adlarını düzenlemek istersen buraya ekleyebilirsin.
        // Ama şimdilik standart konfigürasyon yeterli.

        builder.ApplyConfigurationsFromAssembly(typeof(ChatterDbContext).Assembly);
    }
}