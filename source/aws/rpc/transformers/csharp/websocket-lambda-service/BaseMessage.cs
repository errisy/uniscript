using System.Text.Json;

namespace UniRpc
{
    public class BaseMessage
    {
        public string Id { get; set; }
        public string Service { get; set; }
        public string Method { get; set; }
        public string[] GenericArguments { get; set; }
        public JsonElement Payload { get; set; }
        public bool Success { get; set; }
        public string ErrorMessage { get; set; }
    }
}