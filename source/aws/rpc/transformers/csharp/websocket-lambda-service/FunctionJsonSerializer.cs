using System;
using System.IO;
using System.Text;
using System.Text.Json;
using Amazon.Lambda.Core;
using Amazon.Lambda.Serialization.SystemTextJson;

namespace UniRpc
{
    public class FunctionJsonSerializer : ILambdaSerializer
    {
        public T Deserialize<T>(Stream requestStream)
        {
            var type = typeof(T);
            var serializer = new DefaultLambdaJsonSerializer();
            return serializer.Deserialize<T>(requestStream);
        }

        public void Serialize<T>(T response, Stream responseStream)
        {
            var type =  typeof(T);
            var writer = new StreamWriter(responseStream, Encoding.UTF8);
            var json = JsonSerializer.Serialize(response);
            writer.Write(json);
            writer.Flush();
        }
    }
}
