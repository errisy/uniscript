using System.Text.Json;

namespace UniRpc
{
    public static partial class Static
    {
        public static JsonElement AsElement<T>(this T value)
        {
            return JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(value));
        }

        public static BaseMessage ReturnMessage(this BaseMessage message, object value)
        {
            return new BaseMessage()
            {
                Id = message.Id,
                Service = message.Service,
                Method = message.Method,
                GenericArguments = message.GenericArguments,
                Payload = value.AsElement(),
                Success = true
            };
        }

        public static T GetProperty<T>(this JsonElement element, string name)
        {
            return JsonSerializer.Deserialize<T>(element.GetProperty(name).GetRawText());
        }

        public static object GetPropertyByReflection(this JsonElement element, string name)
        {
            var typeName = element.GetProperty(name).GetProperty("__reflection").GetString();
            return JsonSerializer.Deserialize(element.GetProperty(name).GetRawText(), System.Type.GetType(typeName));
        }
    }
}