using Chatter.Domain.Common.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Chatter.Domain.Common
{
    public abstract class AuditableEntity<TKey> : BaseEntity<TKey>, IAuditable
    {
        public string? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }
    }
}
