using Chatter.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Chatter.Infrastructure.Data.Configurations;

public class MessageAttachmentConfiguration : IEntityTypeConfiguration<MessageAttachment>
{
    public void Configure(EntityTypeBuilder<MessageAttachment> builder)
    {
        builder.ToTable("MessageAttachments");

        builder.HasKey(ma => ma.Id);

        builder.Property(ma => ma.FileName)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(ma => ma.FileUrl)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(ma => ma.Type)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(ma => ma.MimeType)
            .HasMaxLength(100);

        builder.Property(ma => ma.ThumbnailUrl)
            .HasMaxLength(1000);

        // Indexes
        builder.HasIndex(ma => ma.MessageId);
        builder.HasIndex(ma => ma.Type);
    }
}
