import { HttpServiceBase } from "./HttpServiceBase";
import { IRequestContext, IWebSocketConnection, IWebsocketEvent, IWebSocketUser, LambdaContext } from "./LambdaWebsocketTypes";
import { BaseMessage } from "./BaseMessage";
// import { GroupClausesAuthorize } from './GroupAuthorizations'
import { __ServiceRelayRoutes } from '../ServiceRelays';
import express, {Express, Request, Response} from 'express';
import bodyParser from "body-parser";

// const UniRpcApplication = process.env['UniRpcApplication'];
// const UniRpcEnvironmentTarget = process.env['UniRpcEnvironmentTarget'];
// const WebSocketConnectionsTable = process.env['WebSocketConnectionsTable'];
// const WebSocketUsersTable = process.env['WebSocketUsersTable'];

function findRoute(service: string): string {
  let sections = service.split('.');
  let node = __ServiceRelayRoutes;
  while (typeof node != 'string') {
    if (typeof node == 'undefined') {
      throw new Error(`No Target Defined for Service "${service}"`);
    }
    let current = sections.shift() as string;
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

export class HttpService {
  tracking: {[serial: string]: any} = {};
  services: Map<string, HttpServiceBase> = new Map<string, HttpServiceBase>();
  user: IWebSocketUser;
  username: string;
  groups: string[];
  context: IRequestContext;
  messageId: string;
  lambdaContext: LambdaContext;

  constructor(public application: Express, public basePath: string) {
  }

  RegisterService<T extends HttpServiceBase>(service: T): this {
    service.__httpService = this;
    this.services.set(service.__reflection, service);
    this.application.post(this.basePath, bodyParser.json(), async (request, response) => {
      console.log('On Receive message', request.headers, request.method, request.body);
      await this.ProcessEvent(request, response);
    });
    return this;
  }

  async ProcessEvent(request: Request, response: Response) {
    if (this.services.size == 0) {
      console.warn('No Service is registered.');
    }
    // this.context = event.requestContext;
    // try {
    //   this.user = await this.GetUser(event.requestContext);
    // } catch (ex) {
    //   console.error(ex);
    //   return {
    //     statusCode: 401,
    //     body: 'Unauthorized'
    //   };
    // }
    // let message: BaseMessage = parseBody<BaseMessage>(event.body);
    let message: BaseMessage = parseBody(request.body);
    console.log(`Input Message: ${request.body}`);
    // this.username = this.user.Username.S;
    // this.groups = JSON.parse(this.user.Groups.S);
    // if (!GroupClausesAuthorize(this.groups, message.Service, message.Method)) {
    //   console.error(`Groups "${this.groups.join(', ')}" are allowed to invoke "${message.Service}.${message.Method}"`);
    //   return {
    //     statusCode: 401,
    //     body: 'Unauthorized'
    //   };
    // }
    if (this.services.has(message.Service)) {
      try {
        let service = this.services.get(message.Service) as HttpServiceBase;
        this.messageId = message.Id as string;
        service.__user = this.username;
        service.__groups = this.groups;
        let result = await service.__invoke(message);
        if (message.InvokeType == 'RequestResponse') {
          return result;
        } else {
          response.send(result);
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

  // async GetUser(context: IRequestContext): Promise<IWebSocketUser> {
  //   let match: RegExpExecArray | null;
  //   if (match =  /^\$INVOKE-AS:([\w]+)@\[([\w\.,]+)\]$/ig.exec(context.connectionId)) {
  //       let websocketUser: IWebSocketUser = {
  //         Username: { S: match[1] },
  //         Groups: { S: JSON.stringify(match[2].split(',')) } 
  //       } as any;
  //       return websocketUser;
  //   } else {
  //     let connectionResponse = await (dynamo.getItem({
  //       TableName: WebSocketConnectionsTable,
  //       Key: {
  //           ConnectionId: { S: context.connectionId }
  //       }
  //     }).promise());
  //     if(!connectionResponse.Item) throw new Error(`No Connection was found for Connection Id ${context.connectionId}`);
  //     let connection: IWebSocketConnection = connectionResponse.Item as any;
  //     let userResponse = await (dynamo.getItem({
  //         TableName: WebSocketUsersTable,
  //         Key: {
  //             Username: { S: connection.Username.S }
  //         }
  //     }).promise());
  //     if(!userResponse.Item) throw new Error(`No user was found for User Id ${connection.Username.S} via Connection Id ${context.connectionId}`);
  //     return userResponse.Item as any;
  //   }
  // }
  
  // async InvokeService(message: BaseMessage, invokeType: 'Event' | 'RequestResponse'): Promise<any> {
  //   let functionName: string = findRoute(message.Service);
  //   message.Id = this.messageId;
  //   message.InvokeType = invokeType;
  //   let context: IRequestContext = JSON.parse(JSON.stringify(this.context));
  //   if (invokeType == 'Event') {
  //     context.connectionId = `$INVOKE-AS:${this.username}@[${this.groups.join(',')}]`;
  //   }
  //   let response = await (lambda.invoke({
  //     FunctionName: `${UniRpcApplication}--${functionName}--${UniRpcEnvironmentTarget}`,
  //     InvocationType: invokeType,
  //     Payload: JSON.stringify({
  //       requestContext: context,
  //       body: JSON.stringify(message)
  //     })
  //   }).promise());
  //   if (invokeType == 'Event') {
  //     return undefined;
  //   } else {
  //     return (JSON.parse(response.Payload.toString()) as BaseMessage).Payload;
  //   }
  // }

  // async InvokeServiceVoid(message: BaseMessage, invokeType: 'Event' | 'RequestResponse'): Promise<void> {
  //   let functionName: string = findRoute(message.Service);
  //   message.Id = this.messageId;
  //   message.InvokeType = invokeType;
  //   let context: IRequestContext = JSON.parse(JSON.stringify(this.context));
  //   if (invokeType == 'Event') {
  //     context.connectionId = `$INVOKE-AS:${this.username}@[${this.groups.join(',')}]`;
  //   }
  //   let response = await (lambda.invoke({
  //     FunctionName: `${UniRpcApplication}--${functionName}--${UniRpcEnvironmentTarget}`,
  //     InvocationType: invokeType,
  //     Payload: JSON.stringify({
  //       requestContext: context,
  //       body: JSON.stringify(message)
  //     })
  //   }).promise());
  // }
}

export class LogicTerminationError extends Error { }
