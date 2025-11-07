using Chatter.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Chatter.Infrastructure.Data.Configurations;

public class MessageReactionConfiguration : IEntityTypeConfiguration<MessageReaction>
{
    public void Configure(EntityTypeBuilder<MessageReaction> builder)
    {
        builder.ToTable("MessageReactions");

        builder.HasKey(mr => mr.Id);

        builder.Property(mr => mr.Emoji)
            .IsRequired()
            .HasMaxLength(10);

        // Indexes
        builder.HasIndex(mr => mr.MessageId);
        builder.HasIndex(mr => mr.UserId);
        builder.HasIndex(mr => new { mr.MessageId, mr.UserId }).IsUnique();
    }
}
