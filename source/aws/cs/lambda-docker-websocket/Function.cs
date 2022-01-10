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
        /// A simple function that takes a string and returns both the upper and lower case version of the string.
        /// </summary>
        /// <param name="input"></param>
        /// <param name="context"></param>
        /// <returns></returns>
        public async Task<APIGatewayProxyResponse> FunctionHandler(APIGatewayProxyRequest input, ILambdaContext context)
        {
            Console.WriteLine("AWS Lambda Project \"cs-lbd-ws-1\".");
            var websocketService = new WebsocketService();
            // websocketService.RegisterService(new Service());
            await websocketService.ProcessEvent(input);
            return new APIGatewayProxyResponse
            {
                StatusCode = 202,
                Body = "Accepted."
            };
        }
    }
}
