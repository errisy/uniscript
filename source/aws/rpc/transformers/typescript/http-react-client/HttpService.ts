import { GetUniRpcApiOptions } from '../UniRpc.Environments';
import { BaseMessage } from './BaseMessage';

function findEndPiont(key: string, value: {[Service: string]: string} | string): string | undefined {
  if (typeof value == 'string') return value;
  let sections = key.split('.');
  let rest: string[] = [];
  while (sections.length > 0) {
    let name = sections.join('.');
    if (name in value) {
      let found = findEndPiont(rest.join('.'), value[name]);
      if (typeof found == 'string') {
        return found;
      }
    }
    rest.push(sections.pop() as string);
  }
  return undefined;
}

export class HttpService {

  tracking: {[Id: string]: any} = {};
  options: {[Service: string]: string} | string = {};

  constructor() {
    this.options = GetUniRpcApiOptions() as any;
  }

  generateId(length: number): string{
    let now = new Date();
    let sections: string[] = [];
    sections.push(now.getUTCFullYear().toString().padStart(4, '0'));
    sections.push((now.getUTCMonth()+1).toString().padStart(2,'0'));
    sections.push(now.getUTCDate().toString().padStart(2,'0'));
    sections.push('-');
    sections.push(now.getUTCHours().toString().padStart(2,'0'));
    sections.push(now.getUTCMinutes().toString().padStart(2,'0'));
    sections.push(now.getUTCSeconds().toString().padStart(2,'0'));
    sections.push(now.getMilliseconds().toString().padStart(3,'0'));
    sections.push('-');
    for(let i = 0; i < length; i++){
      sections.push(Math.floor(Math.random() * 36).toString(36));
    }
    return sections.join('');
  }

  async send(message: BaseMessage): Promise<BaseMessage> {
    let Id = this.generateId(16);
    message.Id = Id;
    this.tracking[Id] = message;
    console.log('tracking:', this.tracking);
    let endpoint = findEndPiont(message.Service, this.options) as string;
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
    return (response.json() as any) as BaseMessage;
  }
}
