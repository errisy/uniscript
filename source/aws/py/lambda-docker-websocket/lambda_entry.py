# use the '../.env' environment variables for local debugging
import use_env
import json
import asyncio
from typing import Dict
from UniRpc.LambdaWebsocketTypes import IWebsocketEvent
from UniRpc.WebsocketService import WebsocketService


async def websocket_handler(event: IWebsocketEvent):
    websocketService: WebsocketService = WebsocketService()
    # register your service implementations here
    # websocketService.RegisterService(Namespace.ServiceImpl())
    response = await websocketService.ProcessEvent(event)
    print('Function Response:', json.dumps(response))
    return response


def handler(event: IWebsocketEvent, context: Dict[str, any] = None):
    return asyncio.run(websocket_handler(event))


if __name__ == '__main__':
    handler({})