from __future__ import annotations
from abc import ABC, abstractmethod
from typing import TypedDict, Dict, List, Any
from enum import Enum


class IIdentity(TypedDict):
    sourceIp: str


class EventTypeEnum(str, Enum):
    CONNECT = 'CONNECT'
    MESSAGE = 'MESSAGE'


class MessageDirectionEnum(str, Enum):
    IN = 'IN'


class IRequestContext(TypedDict):
    connectedAt: int
    requestTimeEpoch: int
    requestId: str
    messageId: str
    routeKey: str
    eventType: EventTypeEnum
    extendedRequestId: str
    requestTime: str
    messageDirection: MessageDirectionEnum
    disconnectReason: str
    domainName: str
    stage: str
    identity: IIdentity
    connectionId: str
    apiId: str
    debug: bool


class IBodyBase(TypedDict):
    action: str
    serial: str
    value: Any
    User: str
    Method: str
    Success: bool
    Reason: str
    Continue: bool


class IDataFrame(TypedDict):
    serial: str
    index: int
    data: str


class IWebsocketEvent(TypedDict):
    requestContext: IRequestContext
    queryStringParameters: Dict[str, str]
    multiValueQueryStringParameters: Dict[str, List[str]]
    headers: Dict[str, str]
    isBase64Encoded: bool
    body: str


class IAttributeValue(TypedDict):
    S: str
    N: str
    B: str
    SS: List[str]
    NS: List[str]
    BS: List[str]
    M: Dict[str, IAttributeValue]
    L: List[IAttributeValue]
    NULL: bool
    BOOL: bool


class IWebSocketUser(TypedDict):
    Username: IAttributeValue
    Connections: IAttributeValue
    Groups: IAttributeValue
    LastVisit: IAttributeValue
    LastConnection: IAttributeValue


class IWebSocketConnection(TypedDict):
    ConnectionId: IAttributeValue
    Username: IAttributeValue
    ConnectTime: IAttributeValue


class LambdaContext(ABC):

    @abstractmethod
    def get_remaining_time_in_millis(self) -> float:
        pass

    @property
    def function_name(self) -> str:
        pass

    @property
    def function_version(self) -> str:
        pass

    @property
    def invoked_function_arn(self) -> str:
        pass

    @property
    def memory_limit_in_mb(self) -> int:
        pass

    @property
    def aws_request_id(self) -> str:
        pass

    @property
    def log_group_name(self) -> str:
        pass

    @property
    def log_stream_name(self) -> str:
        pass
