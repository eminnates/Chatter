namespace Chatter.Application.DTOs.Chat
{
    public class WebRTCSignalDto
    {
        public Guid CallId { get; set; }
        public string? Sdp { get; set; }
        public string? Candidate { get; set; }
        public string? SdpMid { get; set; }
        public int? SdpMLineIndex { get; set; }
    }

    /// <summary>
    /// DTO for batched ICE candidate delivery.
    /// Client collects candidates within a 200ms window and sends them all at once,
    /// reducing 20-50 individual WebSocket frames to 1-3 batched frames.
    /// </summary>
    public class ICECandidateDto
    {
        public string Candidate { get; set; } = string.Empty;
        public string? SdpMid { get; set; }
        public int? SdpMLineIndex { get; set; }
    }
}
