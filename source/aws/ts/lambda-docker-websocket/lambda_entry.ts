import './use_env';
import {} from 'aws-sdk';
import { IWebsocketEvent } from './UniRpc/LambdaWebsocketTypes';
import { WebsocketService } from './UniRpc/WebsocketService';

export async function handler (event: IWebsocketEvent) {
    console.log('AWS Lambda Project "@{project}".');
    let websocketService = new WebsocketService();
    await websocketService.ProcessEvent(event);
    return {
        statusCode: 202,
        body: 'Accepted.'
    };
};

// Entry point fo the process
if (require.main == module) {
    (async () => await handler({} as any))();
}