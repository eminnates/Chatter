using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Chatter.Domain.Common.Exceptions
{
    public class MessageException : DomainException
    {
        public MessageException(string message) : base(message) { }
    }
}