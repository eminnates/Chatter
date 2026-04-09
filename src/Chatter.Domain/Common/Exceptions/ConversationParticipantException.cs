using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Chatter.Domain.Common.Exceptions
{
    public class ConversationParticipantException : Exception
    {
        public ConversationParticipantException(string message) : base(message) { }
    }
}