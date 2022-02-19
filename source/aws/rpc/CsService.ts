namespace CsService {
    export class Request {
        name: string;
        age: integer;
    }

    export class Response {
        name: string;
        age: integer;
    }

    export abstract class CsTestService {
        abstract test(message: string): string;
        abstract relay(message: string): string;
        abstract sendNumber(value: long): long;
        abstract sendRequest(request: Request): Response;
    }

    export abstract class CsDockerService {
        abstract test(message: string): string;
        abstract relay(message: string): string;
        abstract sendNumber(value: long): long;
        abstract sendRequest(request: Request): Response;
    }
}