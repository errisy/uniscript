using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json;
using System.Text;
using System.IO;
using System.Linq;
using System.Reflection;
using Amazon.DynamoDBv2.Model;
using Amazon.DynamoDBv2;
using Amazon.ApiGatewayManagementApi;
using Amazon.ApiGatewayManagementApi.Model;
using Amazon.DynamoDBv2.DataModel;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda;
using Amazon.Lambda.Model;

namespace UniRpc
{
    public static partial class Static
    {
        public static string UniRpcApplication = System.Environment.GetEnvironmentVariable("UniRpcApplication");
        public static string UniRpcEnvironmentTarget = System.Environment.GetEnvironmentVariable("UniRpcEnvironmentTarget");
        public static string WebSocketConnectionsTable = System.Environment.GetEnvironmentVariable("WebSocketConnectionsTable");
        public static string WebSocketUsersTable = System.Environment.GetEnvironmentVariable("WebSocketUsersTable");
        public static AmazonDynamoDBClient dynamo = new AmazonDynamoDBClient();
        public static AmazonLambdaClient lambda = new AmazonLambdaClient();
        public static string FindRoute(string service)
        {
            List<string> sections = service.Split('.').ToList();
            object node = __ServiceRelayRoutes;
            while (node.GetType() != typeof(string))
            {
                if (node == null)
                {
                    throw new Exception($"No Target Defined for Service \"{service}\"");
                }
                var current = sections.First();
                sections.RemoveAt(0);
                PropertyInfo propertyInfo = node.GetType().GetProperty(current);
                if (propertyInfo != null)
                {
                    throw new Exception($"No Target Defined for Service \"{service}\"");
                }
                else
                {
                    node = propertyInfo.GetValue(node);
                }
            }
            return node.ToString();
        }
    }

    public class WebsocketService
    {
        public Dictionary<string, object> tracking = new Dictionary<string, object>();

        public Dictionary<string, WebsocketServiceBase> services = new Dictionary<string, WebsocketServiceBase>();
        public Dictionary<string, AttributeValue> user { get; set; }
        public WebsocketService RegisterService<T>(T service) where T : WebsocketServiceBase
        {
            if (services.ContainsKey(service.__reflection))
            {
                services[service.__reflection] = service;
            }
            else
            {
                services.Add(service.__reflection, service);
            }
            return this;
        }

        public async Task<APIGatewayProxyResponse> ProcessEvent(APIGatewayProxyRequest _event)
        {
            try
            {
                user = await GetUser(_event.RequestContext);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex);
                return new APIGatewayProxyResponse
                {
                    StatusCode = 401,
                    Body = "Unauthorized."
                };
            }
            BaseMessage message  = JsonSerializer.Deserialize<BaseMessage>(_event.Body);
            string[] groups = JsonSerializer.Deserialize<string[]>(user[IWebSocketUser.Groups].S);
            if (!Static.GroupClausesAuthorize(groups, message.Service, message.Method))
            {
                return new APIGatewayProxyResponse
                {
                    StatusCode = 401,
                    Body = "Unauthorized"
                };
            }
            if (services.ContainsKey(message.Service))
            {
                var service = services[message.Service];
                var result = await service.__invoke(message);
                await Respond(_event.RequestContext, result);
                return new APIGatewayProxyResponse
                {
                    StatusCode = 202,
                    Body = "Accepted"
                };
            }
            return new APIGatewayProxyResponse
            {
                StatusCode = 403,
                Body = "Forbidden"
            };
        }

        public async Task<Dictionary<string, AttributeValue>> GetUser(APIGatewayProxyRequest.ProxyRequestContext context) {
            var connectionResponse = await Static.dynamo.GetItemAsync(
                new GetItemRequest {
                    TableName = Static.WebSocketConnectionsTable,
                    Key = new Dictionary<string, AttributeValue> {
                    { "ConnectionId", new AttributeValue { S = context.ConnectionId } }
                }
                });
            if (connectionResponse.Item == null)
            {
                throw new Exception($"No Connection was found for Connection Id {context.ConnectionId}");
            }
            Dictionary<string, AttributeValue> connection = connectionResponse.Item;
            var userResponse = await Static.dynamo.GetItemAsync(
                new GetItemRequest {
                    TableName = Static.WebSocketUsersTable,
                    Key = new Dictionary<string, AttributeValue> {
                        {  "Username", new AttributeValue{ S = connection[IWebSocketUser.Username].S } }
                    }
                });
            if (userResponse.Item == null)
            {
                throw new Exception($"No user was found for User Id {connection[IWebSocketUser.Username].S} via Connection Id {context.ConnectionId}");
            }
            return userResponse.Item;
        }

        public async Task RespondUnauthorized(APIGatewayProxyRequest _event, BaseMessage message) {
            BaseMessage response = new BaseMessage();
            response.Id = message.Id;
            response.Service = message.Service;
            response.Method = message.Method;
            response.Success = false;
            response.ErrorMessage = "Unauthorzied";
            await Respond(_event.RequestContext, response);
        }

        public async Task Respond(APIGatewayProxyRequest.ProxyRequestContext context, object data) {
            var agm = new AmazonApiGatewayManagementApiClient(
                new AmazonApiGatewayManagementApiConfig()
                {
                    ServiceURL = $"{context.DomainName}/{context.Stage}"
                }
            );
            var stringData = JsonSerializer.Serialize(data);
            await agm.PostToConnectionAsync(new PostToConnectionRequest
            {
                ConnectionId = context.ConnectionId,
                Data = new MemoryStream(Encoding.UTF8.GetBytes(stringData))
            });
        }

        public async Task<BaseMessage> InvokeService(BaseMessage message, string invokeType)
        {
            string targetName = Static.FindRoute(message.Service);
            var response = await Static.lambda.InvokeAsync(new InvokeRequest()
            {
                FunctionName = $"{Static.UniRpcApplication}--{targetName}--{Static.UniRpcEnvironmentTarget}",
                InvocationType = invokeType,
                Payload = JsonSerializer.Serialize(message)
            });
            if (invokeType == "Event")
            {
                return null;
            }
            else
            {
                using (StreamReader reader = new StreamReader(response.Payload))
                {
                    return JsonSerializer.Deserialize<BaseMessage>(reader.ReadToEnd());
                }
            }
        }
    }
}