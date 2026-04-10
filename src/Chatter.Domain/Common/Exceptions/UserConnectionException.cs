using System;

namespace Chatter.Domain.Common.Exceptions
{
    public class UserConnectionException : DomainException
    {
        public UserConnectionException(string message) : base(message)
        {
        }
    }
}