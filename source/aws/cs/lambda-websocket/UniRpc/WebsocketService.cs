using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json;
using System.Text;
using System.IO;
using Amazon.DynamoDBv2.Model;
using Amazon.DynamoDBv2;
using Amazon.ApiGatewayManagementApi;
using Amazon.ApiGatewayManagementApi.Model;
using Amazon.DynamoDBv2.DataModel;
using Amazon.Lambda.APIGatewayEvents;

namespace UniRpc
{
    public static partial class Static
    {
        public static string WebSocketConnectionsTable = Environment.GetEnvironmentVariable("WebSocketConnectionsTable");
        public static string WebSocketUsersTable = Environment.GetEnvironmentVariable("WebSocketUsersTable");
        public static AmazonDynamoDBClient dynamo = new AmazonDynamoDBClient();
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

        public async Task<object> ProcessEvent(APIGatewayProxyRequest _event)
        {
            try
            {
                user = await GetUser(_event.RequestContext);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex);
                return new {
                    statusCode = 401,
                    body = "Unauthorized"
                };
            }
            BaseMessage message  = JsonSerializer.Deserialize<BaseMessage>(_event.Body);
            if (!Static.GroupClausesAuthorize(user[IWebSocketUser.Groups].S, message.Service, message.Method))
            {
                return new {
                    statusCode = 401,
                    body = "Unauthorized"
                };
            }
            if (services.ContainsKey(message.Service))
            {
                var service = services[message.Service];
                var result = await service.__invoke(message);
                await Respond(_event.RequestContext, result);
                return new {
                    statusCode = 202,
                    body = "Accepted"
                };
            }
            return new {
                statusCode = 403,
                body = "Forbidden"
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
    }
}