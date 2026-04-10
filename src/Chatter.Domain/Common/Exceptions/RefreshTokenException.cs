using System;

namespace Chatter.Domain.Common.Exceptions
{
    public class RefreshTokenException : DomainException
    {
        public RefreshTokenException(string message) : base(message)
        {
        }
    }
}