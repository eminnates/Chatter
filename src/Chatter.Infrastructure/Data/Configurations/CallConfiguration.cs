using Chatter.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Chatter.Infrastructure.Data.Configurations
{
    public class CallConfiguration : IEntityTypeConfiguration<Call>
    {
        public void Configure(EntityTypeBuilder<Call> builder)
        {
            builder.ToTable("Calls");

            builder.HasKey(c => c.Id);

            builder.Property(c => c.ConversationId)
                .IsRequired();

            builder.Property(c => c.InitiatorId)
                .IsRequired();

            builder.Property(c => c.Type)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);

            builder.Property(c => c.Status)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(20);

            builder.Property(c => c.DurationInSeconds)
                .IsRequired(false);

            // Indexes
            builder.HasIndex(c => c.ConversationId);
            builder.HasIndex(c => c.InitiatorId);
            builder.HasIndex(c => c.Status);
            builder.HasIndex(c => c.CreatedAt);
            builder.HasIndex(c => new { c.Status, c.ConversationId });

            // Relationships
            builder.HasOne(c => c.Conversation)
                .WithMany()
                .HasForeignKey(c => c.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(c => c.Initiator)
                .WithMany()
                .HasForeignKey(c => c.InitiatorId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
