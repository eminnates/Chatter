using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Chatter.Domain.Common.Exceptions
{
    public class ConversationException : Exception
    {
        public ConversationException(string message) : base(message) { }
    }
}