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
}
