using System.Text.Json;

namespace UniRpc
{
    public static partial class Static
    {
        public static BaseMessage ReturnMessage(BaseMessage message, JsonElement value)
        {
            return new BaseMessage()
            {
                Id = message.Id,
                Service = message.Service,
                Method = message.Method,
                GenericArguments = message.GenericArguments,
                Payload = value,
                Success = true
            };
        }
    }
}