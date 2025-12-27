using Chatter.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Chatter.Infrastructure.Data.Configurations;

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        // Standart AspNetUsers yerine daha temiz "Users" ismi
        builder.ToTable("Users");

        // Validasyonlar
        builder.Property(u => u.FullName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(u => u.Bio)
            .HasMaxLength(500);

        builder.Property(u => u.ProfilePictureUrl)
            .HasMaxLength(500);

        builder.Property(u => u.IsOnline)
            .HasDefaultValue(false);

        // İndeksler (Performans İçin Kritik)
        // Login olurken veya arama yaparken hız kazandırır
        builder.HasIndex(u => u.Email).IsUnique();
        builder.HasIndex(u => u.UserName).IsUnique();
        // "Kimler Online?" sorgusu için indeks
        builder.HasIndex(u => u.IsOnline); 
        // "Son görülme" sıralaması için indeks
        builder.HasIndex(u => u.LastSeenAt);

        // --- İLİŞKİLER (Guid Geçişine Dikkat) ---

        // 1. Refresh Token (Kullanıcı silinirse token da silinsin -> Cascade)
        builder.HasMany(u => u.RefreshTokens)
            .WithOne(rt => rt.User)
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // 2. Mesajlar (Kullanıcı silinse bile mesajları KALSIN -> Restrict)
        // Bu çok önemli, geçmiş sohbetler bozulmasın.
        builder.HasMany(u => u.SentMessages)
            .WithOne(m => m.Sender)
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        // 3. Sohbet Katılımcıları (Kullanıcı silinirse gruptan çıksın -> Cascade)
        builder.HasMany(u => u.ConversationParticipants)
            .WithOne(cp => cp.User)
            .HasForeignKey(cp => cp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // 4. Bağlantılar (SignalR connectionları, kullanıcı gidince silinsin -> Cascade)
        builder.HasMany(u => u.Connections)
            .WithOne(uc => uc.User)
            .HasForeignKey(uc => uc.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}