# use the '../.env' environment variables for local debugging
import use_env
import asyncio
from typing import Dict
from UniRpc.LambdaWebsocketTypes import IWebsocketEvent
from UniRpc.WebsocketService import WebsocketService


async def websocket_handler(event: IWebsocketEvent):
    websocketService: WebsocketService = WebsocketService()
    # register your service implementations here
    # websocketService.RegisterService(Namespace.ServiceImpl())
    await websocketService.ProcessEvent(event)


def handler(event: IWebsocketEvent, context: Dict[str, any] = None):
    return asyncio.run(websocket_handler(event))


if __name__ == '__main__':
    handler({})