from __future__ import annotations
from typing import Dict, Any, List
import json
import boto3
import os
import traceback

from UniRpc.WebsocketServiceBase import WebsocketServiceBase
from UniRpc.LambdaWebsocketTypes import IWebSocketUser, IWebsocketEvent, IRequestContext, IWebSocketConnection
from UniRpc.BaseMessage import BaseMessage
from UniRpc.GroupAuthorizations import GroupClausesAuthorize


UniRpcApplication = os.getenv('UniRpcApplication')
UniRpcEnvironmentTarget = os.getenv('UniRpcEnvironmentTarget')
WebSocketConnectionsTable = os.getenv('WebSocketConnectionsTable')
WebSocketUsersTable = os.getenv('WebSocketUsersTable')


dynamo = boto3.client('dynamodb')
_lambda = boto3.client('lambda')


def find_route(service: str) -> str:
    sections: List[str] = service.split('.')
    node = __ServiceRelayRoutes
    while not isinstance(node, str):
        if not isinstance(node, dict):
            raise Exception(f'No Function Defined for Service "{service}"')
        current: str = sections.pop(0)
        if current in node.keys():
            node = node[current]
        else:
            raise Exception(f'No Function Defined for Service "{service}"')
    return node


class WebsocketService:
    tracking: Dict[str, Any] = dict()
    services: Dict[str, WebsocketServiceBase] = dict()
    user: IWebSocketUser
    context: IRequestContext

    def RegisterService(self, service: WebsocketServiceBase) -> WebsocketService:
        service.WEBSOCKETSERVICEBASE__websocketService = self
        self.services[service['__reflection']] = service
        return self

    async def ProcessEvent(self, event: IWebsocketEvent):
        self.context = event['requestContext']
        try:
            self.user = await self.GetUser(event['requestContext'])
        except Exception as exception:
            print(exception)
            return {
                'statusCode': 401,
                'body': 'Unauthorized'
            }
        message: BaseMessage = json.loads(event['body'])
        groups: List[str] = json.loads(self.user['Groups']['S'])
        if not GroupClausesAuthorize(groups, message['Service'], message['Method']):
            return {
                'statusCode': 401,
                'body': 'Unauthorized'
            }
        if message['Service'] in self.services.keys():
            service = self.services[message['Service']]
            try:
                result = await service.WEBSOCKETSERVICEBASE__invoke(message)
                self.Respond(event['requestContext'], result)
                return {
                    'statusCode': 202,
                    'body': 'Accepted'
                }
            except LogicTerminationException as ex:
                return {
                    'statusCode': 202,
                    'body': 'Accepted'
                }
            except Exception as ex:
                print(ex)
                traceback.print_exc()
                return {
                    'statusCode': 500,
                    'body': 'Internal Server Error'
                }
        return {
            'statusCode': 403,
            'body': 'Forbidden'
        }

    async def GetUser(self, context: IRequestContext):
        connectionId = context['connectionId']
        connectionResponse: Dict[str, Any] = dynamo.get_item(
            TableName=WebSocketConnectionsTable,
            Key={
                'ConnectionId': {
                    'S': connectionId
                }
            }
        )
        if 'Item' not in connectionResponse.keys():
            raise Exception(f'No Connection was found for Connection Id {connectionId}')
        connection: IWebSocketConnection = connectionResponse['Item']
        username = connection['Username']['S']
        userResponse = dynamo.get_item(
            TableName=WebSocketUsersTable,
            Key={
                'Username': {
                    'S': username
                }
            }
        )
        if 'Item' not in userResponse.keys():
            raise Exception(f'No user was found for User Id {username} via Connection Id ${connectionId}')
        return userResponse['Item']

    def RespondUnauthorized(self, event: IWebsocketEvent, message: BaseMessage):
        response: BaseMessage = {
            'Id': message['Id'],
            'Service': message['Service'],
            'Method': message['Method'],
            'Success': False,
            'ErrorMessage': 'Unauthorzied'
        }
        self.Respond(event['requestContext'], response)

    def Respond(self, context: IRequestContext, data: any):
        agm = boto3.client(
            'apigatewaymanagementapi', endpoint_url='https://' + context['domainName'] + '/' + context['stage']
        )
        connectionId: str = context['connectionId']
        stringData: str = json.dumps(data)
        agm.post_to_connection(
            ConnectionId=connectionId,
            Data=stringData
        )

    async def InvokeService(self, message: BaseMessage, invoke_type: str) -> Any:
        function_name: str = find_route(message['Service'])
        response = _lambda.invoke(
            FunctionName=f'{UniRpcApplication}--{function_name}--{UniRpcEnvironmentTarget}',
            InvocationType=invoke_type,
            Payload={
                'requestContext': self.context
                'body': json.dumps(message)
            }
        )
        if invoke_type == 'Event':
            return None
        else:
            return json.loads(response['Payload'].decode('utf-8'))


class LogicTerminationException(Exception):
    def __init__(self, message: str):
        super().__init__(message)