using System;
using System.Collections.Generic;

namespace Chatter.Application.DTOs.Chat;

public class ConversationListDto
{
    public List<ConversationDto> Conversations { get; set; } = new();
}
