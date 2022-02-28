from typing import List, Coroutine, Any
from abc import abstractmethod
from UniRpc.BaseMessage import BaseMessage


class WebsocketServiceBase:
    WEBSOCKETSERVICEBASE__websocketService: Any
    __reflection: str
    __isGeneric: bool
    __genericArguments: List[str]
    __user: str
    __groups: List[str]
    __message_id: str

    def __getitem__(self, key: str):
        if key == '__reflection':
            return self.__reflection
        elif key == '__isGeneric':
            return self.__isGeneric
        elif key == '__genericArguments':
            return self.__genericArguments
        elif key == '__user':
            return self.__user
        elif key == '__groups':
            return self.__groups
        elif key == 'WEBSOCKETSERVICEBASE__websocketService':
            return self.WEBSOCKETSERVICEBASE__websocketService

    def __setitem__(self, key: str, value: Any):
        if key == '__reflection':
            self.__reflection = value
        elif key == '__isGeneric':
            self.__isGeneric = value
        elif key == '__genericArguments':
            self.__genericArguments = value
        elif key == '__user':
            self.__user = value
        elif key == '__groups':
            self.__groups = value
        elif key == 'WEBSOCKETSERVICEBASE__websocketService':
            self.WEBSOCKETSERVICEBASE__websocketService = value

    @abstractmethod
    async def WEBSOCKETSERVICEBASE__outgoing(self, message: BaseMessage) -> None:
        pass

    @abstractmethod
    async def WEBSOCKETSERVICEBASE__invoke(self, message: BaseMessage) -> BaseMessage:
        pass
