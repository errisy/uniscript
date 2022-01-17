import './use_env';
import {} from 'aws-sdk';
import { IWebsocketEvent } from './UniRpc/LambdaWebsocketTypes';
import { WebsocketService } from './UniRpc/WebsocketService';

export async function handler (event: IWebsocketEvent) {
    console.log('AWS Lambda Project "@{project}".');
    let websocketService = new WebsocketService();
    // Register your service implementations here.
    // websocketService.RegisterService(new Namespace.ServiceImpl());
    return await websocketService.ProcessEvent(event);
};

// Entry point fo the process
if (require.main == module) {
    (async () => await handler({} as any))();
}