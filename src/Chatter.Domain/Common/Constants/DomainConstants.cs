using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Chatter.Domain.Common.Constants
{
    public static class DomainConstants
    {
        public const int MaxUsernameLength = 50;
        public const int MaxMessageLength = 5000;
        public const int MaxGroupNameLength = 100;
        public const int MaxFileSize = 10485760; // 10 MB
    }

    public static class ValidationMessages
    {
        public const string RequiredField = "{0} alanı zorunludur";
        public const string InvalidEmail = "Geçersiz email formatı";
        public const string PasswordTooShort = "Şifre en az 8 karakter olmalıdır";
    }
}
