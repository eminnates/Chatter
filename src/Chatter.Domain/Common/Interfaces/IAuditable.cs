using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Chatter.Domain.Common.Interfaces
{
    public interface IAuditable
    {
        string? CreatedBy { get; set; }
        string? UpdatedBy { get; set; }
    }
}
