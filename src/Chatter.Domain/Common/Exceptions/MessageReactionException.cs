using System;

namespace Chatter.Domain.Common.Exceptions
{
    public class MessageReactionException : DomainException
    {
        public MessageReactionException(string message) : base(message)
        {
        }
    }
}