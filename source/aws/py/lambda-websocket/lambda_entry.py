# use the '../.env' environment variables for local debugging
import use_env
import asyncio
from typing import Dict
from UniRpc.LambdaWebsocketTypes import IWebsocketEvent
from UniRpc.WebsocketService import WebsocketService


async def websocket_handler(event: IWebsocketEvent):
    websocketService: WebsocketService = WebsocketService()
    await websocketService.ProcessEvent(event)


def handler(event: IWebsocketEvent, context: Dict[str, any] = None):
    asyncio.run(websocket_handler(event))
    return {'status': 200}


if __name__ == '__main__':
    handler({})