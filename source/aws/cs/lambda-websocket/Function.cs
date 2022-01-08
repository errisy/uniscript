using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Amazon.Lambda.Core;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Serialization.Json;

using UniRpc;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace LambdaEntry
{
    public class Function
    {
        /// <summary>
        /// A websocket service
        /// </summary>
        /// <param name="input"></param>
        /// <param name="context"></param>
        /// <returns></returns>
        [LambdaSerializer(typeof(JsonSerializer))]
        public async Task<object> FunctionHandler(APIGatewayProxyRequest input, ILambdaContext context)
        {
            Console.WriteLine("AWS Lambda Project \"@{project}\".");
            var websocketService = new WebsocketService();
            // websocketService.RegisterService(new Service());
            await websocketService.ProcessEvent(input);
            return new {
                statusCode = 202,
                body = "Accepted."
            };
        }
    }
}
