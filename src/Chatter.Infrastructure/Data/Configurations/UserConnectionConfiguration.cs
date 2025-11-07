using Chatter.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Chatter.Infrastructure.Data.Configurations;

public class UserConnectionConfiguration : IEntityTypeConfiguration<UserConnection>
{
    public void Configure(EntityTypeBuilder<UserConnection> builder)
    {
        builder.ToTable("UserConnections");

        builder.HasKey(uc => uc.Id);

        builder.Property(uc => uc.ConnectionId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(uc => uc.UserAgent)
            .HasMaxLength(500);

        builder.Property(uc => uc.IpAddress)
            .HasMaxLength(50);

        builder.Property(uc => uc.IsActive)
            .HasDefaultValue(true);

        // Indexes
        builder.HasIndex(uc => uc.ConnectionId).IsUnique();
        builder.HasIndex(uc => uc.UserId);
        builder.HasIndex(uc => new { uc.UserId, uc.IsActive });
    }
}
