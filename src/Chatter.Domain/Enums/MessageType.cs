namespace Chatter.Domain.Enums
{
    public enum MessageType
    {
        Text = 1,
        Image = 2,
        Video = 3,
        Audio = 4,
        File = 5,
        Location = 6,
        Contact = 7,
        System = 8  // "User joined", "User left" gibi sistem mesajları
    }
}
