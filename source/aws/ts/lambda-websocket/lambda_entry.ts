import './use_env';
import {} from 'aws-sdk';
import { IWebsocketEvent } from './UniRpc/LambdaWebsocketTypes';
import { WebsocketService } from './UniRpc/WebsocketService';

export async function handler (event: IWebsocketEvent) {
    console.log('AWS Lambda Project "@{project}".');
    let websocketService = new WebsocketService();
    // Register your service implementations here.
    // websocketService.RegisterService(new Namespace.ServiceImpl());
    let response = await websocketService.ProcessEvent(event);
    console.log('Function Response:', response);
    return response;
};

// Entry point fo the process
if (require.main == module) {
    (async () => await handler({} as any))();
}