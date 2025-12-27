using System;
using System.Collections.Generic;
namespace Chatter.Application.DTOs.Chat;

public class CreateConversationRequest
{
    public string? Name { get; set; } // Grup ise isim zorunlu olabilir
    public bool IsGroup { get; set; } // Type string yerine bool daha güvenli olabilir
    public List<Guid> ParticipantIds { get; set; } = new(); // string -> Guid
}