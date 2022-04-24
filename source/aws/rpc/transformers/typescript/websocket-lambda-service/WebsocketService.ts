import { WebsocketServiceBase } from "./WebsocketServiceBase";
import { IRequestContext, IWebSocketConnection, IWebsocketEvent, IWebSocketUser, LambdaContext } from "./LambdaWebsocketTypes";
import { BaseMessage } from "./BaseMessage";
import { GroupClausesAuthorize } from './GroupAuthorizations'
import { ApiGatewayManagementApi, DynamoDB, Lambda } from 'aws-sdk';
import { __ServiceRelayRoutes } from '../ServiceRelays';

const UniRpcApplication = process.env['UniRpcApplication'];
const UniRpcEnvironmentTarget = process.env['UniRpcEnvironmentTarget'];
const WebSocketConnectionsTable = process.env['WebSocketConnectionsTable'];
const WebSocketUsersTable = process.env['WebSocketUsersTable'];
const dynamo = new DynamoDB();
const lambda = new Lambda();

function findRoute(service: string): string {
  let sections = service.split('.');
  let node = __ServiceRelayRoutes;
  while (typeof node != 'string') {
    if (typeof node == 'undefined') {
      throw new Error(`No Target Defined for Service "${service}"`);
    }
    let current = sections.shift();
    if (current in node) {
      node = node[current];
    } else {
      throw new Error(`No Target Defined for Service "${service}"`);
    }
  }
  return node;
}

function parseBody<T>(data: string | T): T {
  if (typeof data == 'string') {
    return JSON.parse(data);
  }
  return data;
}

export class WebsocketService {
  tracking: {[serial: string]: any} = {};
  services: Map<string, WebsocketServiceBase> = new Map<string, WebsocketServiceBase>();
  user: IWebSocketUser;
  username: string;
  groups: string[];
  context: IRequestContext;
  messageId: string;
  lambdaContext: LambdaContext;

  RegisterService<T extends WebsocketServiceBase>(service: T): this {
    service.__websocketService = this;
    this.services.set(service.__reflection, service);
    return this;
  }

  async ProcessEvent(event: IWebsocketEvent) {
    if (this.services.size == 0) {
      console.warn('No Service is registered.');
    }
    this.context = event.requestContext;
    try {
      this.user = await this.GetUser(event.requestContext);
    } catch (ex) {
      console.error(ex);
      return {
        statusCode: 401,
        body: 'Unauthorized'
      };
    }
    let message: BaseMessage = parseBody<BaseMessage>(event.body);
    console.log(`Input Message: ${event.body}`);
    this.username = this.user.Username.S;
    this.groups = JSON.parse(this.user.Groups.S);
    if (!GroupClausesAuthorize(this.groups, message.Service, message.Method)) {
      console.error(`Groups "${this.groups.join(', ')}" are allowed to invoke "${message.Service}.${message.Method}"`);
      return {
        statusCode: 401,
        body: 'Unauthorized'
      };
    }
    if (this.services.has(message.Service)) {
      try {
        let service = this.services.get(message.Service);
        this.messageId = message.Id;
        service.__user = this.username;
        service.__groups = this.groups;
        let result = await service.__invoke(message);
        if (message.InvokeType == 'RequestResponse') {
          return result;
        } else {
          await this.Respond(event.requestContext, result);
          return {
            statusCode: 202,
            body: 'Accepted'
          };
        }
      } catch (ex) {
        if (ex instanceof LogicTerminationError) {
          return {
            statusCode: 202,
            body: 'Accepted'
          };
        } else if (ex instanceof Error) {
          console.error(ex.name, '=>', ex.message);
          console.error(ex.stack);
          return {
            statusCode: 500,
            body: 'Internal Server Error'
          }
        } else {
          console.error('Not Error Type:', ex);
          return {
            statusCode: 500,
            body: 'Internal Server Error'
          }
        }
      }
    } else {
      let services : string[] = []; 
      for (let key of this.services.keys()){
        services.push(key);
      }
      console.error(`Service "${message.Service}" is not found in [${services.join(', ')}].`)
    }
    return {
      statusCode: 403,
      body: 'Forbidden'
    };
  }

  async GetUser(context: IRequestContext): Promise<IWebSocketUser> {
    let match: RegExpExecArray | null;
    if (match =  /^\$INVOKE-AS:([\w]+)@\[([\w\.,]+)\]$/ig.exec(context.connectionId)) {
        let websocketUser: IWebSocketUser = {
          Username: { S: match[1] },
          Groups: { S: JSON.stringify(match[2].split(',')) } 
        } as any;
        return websocketUser;
    } else {
      let connectionResponse = await (dynamo.getItem({
        TableName: WebSocketConnectionsTable,
        Key: {
            ConnectionId: { S: context.connectionId }
        }
      }).promise());
      if(!connectionResponse.Item) throw new Error(`No Connection was found for Connection Id ${context.connectionId}`);
      let connection: IWebSocketConnection = connectionResponse.Item as any;
      let userResponse = await (dynamo.getItem({
          TableName: WebSocketUsersTable,
          Key: {
              Username: { S: connection.Username.S }
          }
      }).promise());
      if(!userResponse.Item) throw new Error(`No user was found for User Id ${connection.Username.S} via Connection Id ${context.connectionId}`);
      return userResponse.Item as any;
    }
  }

  async RespondUnauthorized(event: IWebsocketEvent, message: BaseMessage) {
    let response: BaseMessage = {} as any;
    response.Id = message.Id;
    response.Service = message.Service;
    response.Method = message.Method;
    response.Success = false;
    response.ErrorMessage = `Unauthorzied`;
    await this.Respond(event.requestContext, response);
  }

  async Respond(context: IRequestContext, data: any): Promise<void> {
    if (/^\$INVOKE-AS:([\w]+)@\[([\w\.,]+)\]$/ig.test(context.connectionId)) {
      return;
    }
    let agm = new ApiGatewayManagementApi({
        endpoint: `${context.domainName}/${context.stage}`
    });
    let stringData = JSON.stringify(data);
    await (agm.postToConnection({
        ConnectionId: context.connectionId,
        Data: stringData
    }).promise());
  }
  
  async InvokeService(message: BaseMessage, invokeType: 'Event' | 'RequestResponse'): Promise<any> {
    let functionName: string = findRoute(message.Service);
    message.Id = this.messageId;
    message.InvokeType = invokeType;
    let context: IRequestContext = JSON.parse(JSON.stringify(this.context));
    if (invokeType == 'Event') {
      context.connectionId = `$INVOKE-AS:${this.username}@[${this.groups.join(',')}]`;
    }
    let response = await (lambda.invoke({
      FunctionName: `${UniRpcApplication}--${functionName}--${UniRpcEnvironmentTarget}`,
      InvocationType: invokeType,
      Payload: JSON.stringify({
        requestContext: context,
        body: JSON.stringify(message)
      })
    }).promise());
    if (invokeType == 'Event') {
      return undefined;
    } else {
      return (JSON.parse(response.Payload.toString()) as BaseMessage).Payload;
    }
  }

  async InvokeServiceVoid(message: BaseMessage, invokeType: 'Event' | 'RequestResponse'): Promise<void> {
    let functionName: string = findRoute(message.Service);
    message.Id = this.messageId;
    message.InvokeType = invokeType;
    let context: IRequestContext = JSON.parse(JSON.stringify(this.context));
    if (invokeType == 'Event') {
      context.connectionId = `$INVOKE-AS:${this.username}@[${this.groups.join(',')}]`;
    }
    let response = await (lambda.invoke({
      FunctionName: `${UniRpcApplication}--${functionName}--${UniRpcEnvironmentTarget}`,
      InvocationType: invokeType,
      Payload: JSON.stringify({
        requestContext: context,
        body: JSON.stringify(message)
      })
    }).promise());
  }
}

export class LogicTerminationError extends Error { }
