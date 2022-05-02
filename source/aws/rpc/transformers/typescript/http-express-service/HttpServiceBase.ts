import { BaseMessage } from './BaseMessage';
import { HttpService } from './HttpService';

export abstract class HttpServiceBase
{
    __httpService: HttpService;
    __reflection: string;
    __isGeneric: boolean;
    __genericArguments: string[];
    abstract __outgoing(message: BaseMessage): void;
    __user: string;
    __groups: string[];
    abstract __invoke(message: BaseMessage): Promise<BaseMessage>;
}