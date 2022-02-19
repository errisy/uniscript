namespace PyService {
    export class Request {
        name: string;
        age: integer;
    }

    export class Response {
        name: string;
        age: integer;
    }

    export abstract class PyTestService {
        abstract test(message: string): string;
        abstract relay(message: string): string;
        abstract sendNumber(value: long): long;
        abstract sendRequest(request: Request): Response;
    }

    export abstract class PyDockerService {
        abstract test(message: string): string;
        abstract relay(message: string): string;
        abstract sendNumber(value: long): long;
        abstract sendRequest(request: Request): Response;
    }
}