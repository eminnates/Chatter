using Chatter.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Chatter.Infrastructure.Data.Configurations;

public class ConversationParticipantConfiguration : IEntityTypeConfiguration<ConversationParticipant>
{
    public void Configure(EntityTypeBuilder<ConversationParticipant> builder)
    {
        builder.ToTable("ConversationParticipants");

        builder.HasKey(cp => cp.Id);

        builder.Property(cp => cp.Role)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(cp => cp.UnreadCount)
            .HasDefaultValue(0);

        builder.Property(cp => cp.IsMuted)
            .HasDefaultValue(false);

        builder.Property(cp => cp.IsActive)
            .HasDefaultValue(true);

        // Indexes
        builder.HasIndex(cp => cp.ConversationId);
        builder.HasIndex(cp => cp.UserId);
        builder.HasIndex(cp => new { cp.ConversationId, cp.UserId }).IsUnique();
        builder.HasIndex(cp => cp.LastReadAt);
        builder.HasIndex(cp => new { cp.UserId, cp.IsActive });
    }
}
