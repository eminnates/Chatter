using System;

namespace Chatter.Domain.Common.Exceptions
{
    public class MessageAttachmentException : DomainException
    {
        public MessageAttachmentException(string message) : base(message)
        {
        }

        // Base DomainException constructor doesnt take Exception yet
        // public MessageAttachmentException(string message, Exception innerException) : base(message, innerException)
        // {
        // }
    }
}