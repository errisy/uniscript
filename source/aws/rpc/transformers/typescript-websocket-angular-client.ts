import { Namespace, Service, Message, Method, Property, Parameter, Type, VoidType, ServiceInterface, MessageInterface, Enum } from './definitions';
import { SourceFileResovler } from './resolvers';
import { RPC, Target } from './rpc-configuration';
import { CodeBuilder } from './code-builder';
import { CopyDirectory, MakeDirectories, Remove, ResolvePath, WriteFile } from './os-utilities';
import * as path from 'path';
import { GroupAuthorization, GroupManagement } from './group-management';

export class Transpiler {
    constructor (private resolver: SourceFileResovler) {
    }
    public emit(target: Target) {
        if (typeof target.ts == 'string' && target.type == 'websocket-angular-client') {
            let rootDirectory = ResolvePath(target.ts);
            this.copyBaseFiles(rootDirectory);
            for (let instance of this.resolver.Children.values()) {
                if (instance.Fullname.length == 1) {
                    let topLevelNamespacePath = path.join(rootDirectory, instance.Name);
                    Remove(topLevelNamespacePath);
                    CodeGeneration.AsEmitter(instance).emitFiles(rootDirectory);
                }
            }
            if (this.resolver.Groups && this.resolver.Groups.size > 0) {
                let groups = new CodeGeneration.GroupAuthorizationsEmitter(this.resolver.Groups);
                groups.emitFile(rootDirectory);
            }
            let reflections = new CodeGeneration.ReflectionsEmitter(this.resolver.Children);
            reflections.emitFile(rootDirectory);
        }
    }
    private copyBaseFiles(rootDirectory: string) {
        let destination = path.normalize(path.join(rootDirectory, 'UniRpc'));
        console.log('Remove:', destination);
        Remove(destination);
        MakeDirectories(destination);
        CopyDirectory('./transformers/typescript/websocket-angular-client', destination);
    }
}

module CodeGeneration {
    const TypeMappings: Map<string, string> = new Map<string, string>();
    TypeMappings.set('boolean', 'boolean');
    TypeMappings.set('string', 'string');
    TypeMappings.set('float', 'number');
    TypeMappings.set('double', 'number');
    TypeMappings.set('integer', 'number');
    TypeMappings.set('long', 'number');
    TypeMappings.set('bytes', 'string');
    TypeMappings.set('void', 'void');
    TypeMappings.set('Promise', 'Promise');

    function importPath(consumer: string[], source: string[]): string | undefined {
        let origin = [...consumer], from = [...source];
        while (origin.length > 0 && from.length > 0 && origin[0] == from[0]) {
            origin.shift();
            from.shift();
        }
        if (origin.length == 0 && from.length == 0) return undefined;
        let referencePath = '';
        for (let i = 1; i < origin.length; ++i) {
            referencePath += '../';
        }
        if (referencePath == '') referencePath = './';
        return `${referencePath}${from.join('/')}`;
    }

    function fullnameAlias(fullname: string[]): string {
        return '$' + fullname.join('_');
    }

    const websocketServiceType = new Type('WebsocketService');
    websocketServiceType.FullName = ['UniRpc', 'WebsocketService'];
    websocketServiceType.ServiceReference = new Service();
    websocketServiceType.ServiceReference.Name = 'WebsocketService';
    websocketServiceType.ServiceReference.Fullname = websocketServiceType.FullName;
    websocketServiceType.Reference = websocketServiceType;

    const websocketServiceBaseType = new Type('WebsocketServiceBase');
    websocketServiceBaseType.FullName = ['UniRpc', 'WebsocketServiceBase'];
    websocketServiceBaseType.ServiceReference = new Service();
    websocketServiceBaseType.ServiceReference.Name = 'WebsocketServiceBase';
    websocketServiceBaseType.ServiceReference.Fullname = websocketServiceBaseType.FullName;
    websocketServiceBaseType.Reference = websocketServiceBaseType;

    const baseMessageType = new Type('BaseMessage');
    baseMessageType.FullName = ['UniRpc', 'BaseMessage'];
    baseMessageType.ServiceReference = new Service();
    baseMessageType.ServiceReference.Name = 'BaseMessage';
    baseMessageType.ServiceReference.Fullname = baseMessageType.FullName;
    baseMessageType.Reference = baseMessageType;

    const reflectionsBaseType = new Type('ReflectionsBase');
    reflectionsBaseType.FullName = ['UniRpc', 'ReflectionsBase'];
    reflectionsBaseType.ServiceReference = new Service();
    reflectionsBaseType.ServiceReference.Name = 'ReflectionsBase';
    reflectionsBaseType.ServiceReference.Fullname = reflectionsBaseType.FullName;
    reflectionsBaseType.Reference = reflectionsBaseType;

    export function mapType(typeInstance: Type, builder: CodeBuilder, fullname: string[]): string {
        if (typeInstance.IsGenericPlaceholder) {
            return typeInstance.Name;
        } else if (typeInstance.IsGeneric) {
            if (typeInstance.GenericDefinition.Reference.SystemType &&
                ['Array', 'List'].includes(typeInstance.GenericDefinition.Reference.SystemType)) {
                // This is the special case for array.
                let arrayType = typeInstance.GenericArguments[0];
                return `${mapType(arrayType, builder, fullname)}[]`;
            } else if(typeInstance.GenericDefinition.Reference.SystemType &&
                ['Dict'].includes(typeInstance.GenericDefinition.Reference.SystemType)) {
                let keyType = typeInstance.GenericArguments[0];
                let valueType = typeInstance.GenericArguments[1];
                return `{[key: ${mapType(keyType, builder, fullname)}]:${mapType(valueType, builder, fullname)}}`;
            } else  {
                return `${mapType(typeInstance.GenericDefinition, builder, fullname)}<${typeInstance.GenericArguments.map(arg => mapType(arg, builder, fullname)).join(', ')}>`;
            }
        } else {
            if (!typeInstance.Reference) {
                console.log('type-instance not resolved:', typeInstance);
            }
            if (typeInstance.Reference.SystemType) {
                if (TypeMappings.has(typeInstance.Reference.SystemType)) {
                    let name = TypeMappings.get(typeInstance.Reference.SystemType);
                    if (name.lastIndexOf('.') > -1) {
                        builder.addImport(name.substr(0, name.lastIndexOf('.')));
                    }
                    return name;
                }
            } else if (typeInstance.Reference.IsGenericPlaceholder) {
                let source = importPath(fullname, typeInstance.Reference.FullName);
                if (source) builder.addHierarchicalImport(source, typeInstance.Name, fullnameAlias(typeInstance.Reference.FullName));
                return fullnameAlias(typeInstance.Reference.FullName);
            } else if (typeInstance.Reference.MessageReference) {
                let source = importPath(fullname, typeInstance.Reference.FullName);
                if (source) builder.addHierarchicalImport(source, typeInstance.Name, fullnameAlias(typeInstance.Reference.MessageReference.Fullname));
                return fullnameAlias(typeInstance.Reference.MessageReference.Fullname);
            } else if (typeInstance.Reference.ServiceReference) {
                let source = importPath(fullname, typeInstance.Reference.FullName);
                if (source) builder.addHierarchicalImport(source, typeInstance.Name, fullnameAlias(typeInstance.Reference.ServiceReference.Fullname));
                return fullnameAlias(typeInstance.Reference.ServiceReference.Fullname);
            } else if (typeInstance.Reference.MessageInterfaceReference) {
                let source = importPath(fullname, typeInstance.Reference.FullName);
                if (source) builder.addHierarchicalImport(source, typeInstance.Name, fullnameAlias(typeInstance.Reference.MessageInterfaceReference.Fullname));
                return fullnameAlias(typeInstance.Reference.MessageInterfaceReference.Fullname);
            } else if (typeInstance.Reference.ServiceInterfaceReference) {
                let source = importPath(fullname, typeInstance.Reference.FullName);
                if (source) builder.addHierarchicalImport(source, typeInstance.Name, fullnameAlias(typeInstance.Reference.ServiceInterfaceReference.Fullname));
                return fullnameAlias(typeInstance.Reference.ServiceInterfaceReference.Fullname);
            }
            console.log('Type Not Found:', typeInstance);
            console.trace(`No System Type Mapping Found in CSharp for "${typeInstance.Reference.SystemType}"`);
            throw `No System Type Mapping Found in CSharp for "${typeInstance.Reference.SystemType}"`;
        }
    }

    export function AsEmitter(instance: Namespace): NamespaceEmitter;
    export function AsEmitter(instance: Service): ServiceEmitter;
    export function AsEmitter(instance: Message): MessageEmitter;
    export function AsEmitter(instance: ServiceInterface): ServiceInterfaceEmitter;
    export function AsEmitter(instance: MessageInterface): MessageInterfaceEmitter;
    export function AsEmitter(instance: Enum): EnumEmitter;
    export function AsEmitter(
        instance: Namespace | Service | Message | ServiceInterface | MessageInterface | Enum): 
        NamespaceEmitter | ServiceEmitter | MessageEmitter | ServiceInterfaceEmitter | MessageInterfaceEmitter | EnumEmitter {
        switch (instance.Reflection) {
            case 'Namespace': return new NamespaceEmitter(instance as Namespace);
            case 'Service': return new ServiceEmitter(instance as Service);
            case 'Message': return new MessageEmitter(instance as Message);
            case 'ServiceInterface': return new ServiceInterfaceEmitter(instance as ServiceInterface);
            case 'MessageInterface': return new MessageInterfaceEmitter(instance as MessageInterface);
            case 'Enum': return new EnumEmitter(instance as Enum);
        }
        console.error('No available Emitter for:', instance);
        throw `Emitter is not available for instance of "${typeof instance}"`;
    }

    interface IImport {
        key: string;
        values?: string[];
        alias?: string;
    }

    function importBuilder(imports: Set<string>, hierarchicalImports: Map<string, Map<string, string>>) {
        let importNamespaces: string[] = [];
        let importLines: IImport[] = [];
        for (let key of hierarchicalImports.keys()) {
            let map = hierarchicalImports.get(key);
            let values: string[] = [];
            for (let name of map.keys()) {
                let alias = map.get(name);
                if (alias) {
                    values.push(`${name} as ${alias}`);
                } else {
                    values.push(name);
                }
            }
            values.sort();
            importLines.push({
                key: key,
                values: values
            });
        }
        importLines.sort((a, b) => {
            return a.key.localeCompare(b.key);
        });
        for (let importLine of importLines) {
            if (importLine.values) {
                importNamespaces.push(`import {${importLine.values.join(', ')}} from "${importLine.key}";`);
            } else if (importLine.alias) {
                importNamespaces.push(`import * as ${importLine.alias} from '${importLine.key}';`);
            }
        }
        return importNamespaces.join('\r\n');
    }

    function emitComments(builder: CodeBuilder, indent: number, comments?: string) {
        if (typeof comments != 'string') return;
        let lines = comments.split('\n');
        if (lines.length == 1) {
            builder.appendLine(`/** ${lines[0]} */`, indent);
        } else if (lines.length > 1) {
            builder.appendLine(`/**`, indent);
            comments.split('\n')
                .map(line => line.replace(/^\s*/ig, ''))
                .map(line => line.replace(/\s*$/ig, ''))
                .map(line => ` * ${line}`)
                .forEach(line => {
                    builder.appendLine(line, indent);
                });
            builder.appendLine(` */`, indent);
        }
    }

    function emitParameterComments(comments?: string) {
        if (typeof comments == 'string') {
            return `/** ${comments} */ `;
        }
        return '';
    }

    class NamespaceEmitter {
        constructor(private instance: Namespace) {
        }
        emitFiles(rootDirectory: string) {
            for (let key of this.instance.Children.keys()) {
                let child = this.instance.Children.get(key);
                switch (child.Reflection) {
                    case 'Namespace': {
                        let instance = child as Namespace;
                        CodeGeneration.AsEmitter(instance).emitFiles(rootDirectory);
                    }  break;
                    case 'Service': {
                        let instance = child as Service;
                        CodeGeneration.AsEmitter(instance).emitFile(rootDirectory);
                    } break;
                    case 'Message': {
                        let instance = child as Message;
                        CodeGeneration.AsEmitter(instance).emitFile(rootDirectory);
                    } break;
                    case 'MessageInterface': {
                        let instance = child as MessageInterface;
                        CodeGeneration.AsEmitter(instance).emitFile(rootDirectory);
                    } break;
                    case 'ServiceInterface': {
                        let instance = child as ServiceInterface;
                        CodeGeneration.AsEmitter(instance).emitFile(rootDirectory);
                    } break;
                    case 'Enum': {
                        let instance = child as Enum;
                        CodeGeneration.AsEmitter(instance).emitFile(rootDirectory);
                    } break;
                }
            }
        }
    }

    class ServiceEmitter {
        constructor (private instance: Service) {}
        emitFile(rootDirectory: string) {
            let filename = path.join(rootDirectory, ...this.instance.Namespace, this.instance.Name + '.ts');
            let builder: CodeBuilder = new CodeBuilder(importBuilder);
            let indent = 0;
            builder.addHierarchicalImport('rxjs', 'Observable');
            builder.addHierarchicalImport('rxjs/operators', 'map');
            builder.addHierarchicalImport('@angular/core', 'Injectable');
            this.emitService(builder, indent);
            console.log('Write Code to:', filename);
            WriteFile(filename, builder.build(), 'utf-8');
        }
        emitHeritage(builder: CodeBuilder) {
            let baseTypes: string[] = [], interfaces: string[] = [];
            if (this.instance.Base) {
                baseTypes.push(this.emitType(this.instance.Base, builder));
            } else {
                baseTypes.push(this.emitType(websocketServiceBaseType, builder));
            }
            if (Array.isArray(this.instance.Implementations)) {
                for (let implementation of this.instance.Implementations) {
                    interfaces.push(this.emitType(implementation, builder));
                }
            }
            let result: string = ''
            if (baseTypes.length > 0) {
                result += ` extends ${baseTypes.join(', ')}`;
            }
            if (interfaces.length > 0) {
                result += ` implements ${interfaces.join(', ')}`;
            }
            return result;
        }
        emitService(builder: CodeBuilder, indent: number) {
            let baseTypes: string[] = [];
            emitComments(builder, indent, this.instance.Comments);
            builder.appendLine('@Injectable({', indent);
            builder.appendLine(`providedIn: 'root'`, indent + 1);
            builder.appendLine(`})`, indent);
            if (this.instance.Base) {
                baseTypes.push(this.emitType(this.instance.Base, builder));
            } else {
                baseTypes.push(this.emitType(websocketServiceBaseType, builder));
            }
            if (Array.isArray(this.instance.Implementations)) {
                for (let implementation of this.instance.Implementations) {
                    baseTypes.push(this.emitType(implementation, builder));
                }
            }
            let heritage = this.emitHeritage(builder);
            if (this.instance.IsGeneric) {
                let genericArugments = this.instance.GenericArguments
                    .map(arg => this.emitType(arg, builder))
                    .join(', ');
                builder.appendLine(`export class ${this.instance.Name}<${genericArugments}>${heritage}`, indent);
            } else {
                builder.appendLine(`export class ${this.instance.Name}${heritage}`, indent);
            }
            builder.appendLine(`{`, indent);
            this.emitServiceConstructor(builder, indent + 1);
            for (let method of this.instance.Methods) {
                this.emitServiceMethod(builder, indent + 1, method);
            }
            builder.appendLine(`}`, indent);
        }
        emitServiceConstructor(builder: CodeBuilder, indent: number) {
            let fullname = this.instance.Fullname.join('.');
            builder.appendLine(`public constructor (private __websocketService: ${this.emitType(websocketServiceType, builder)})`, indent);
            builder.appendLine(`{`, indent);
            if (this.instance.Base) {
                builder.appendLine(`super(__websocketService);`, indent + 1);
            } else {
                builder.appendLine(`super();`, indent + 1);
            }
            builder.appendLine(`this.__reflection = '${fullname}';`, indent + 1);
            if (this.instance.IsGeneric) {
                let genericTypeNames = this.instance.GenericArguments
                    .map(arg => `typeof(${arg.Name}).FullName`)
                    .join(', ');
                builder.appendLine(`this.__genericArguments = [];`, indent + 1);
                // builder.appendLine(`this.__genericArguments = [${genericTypeNames}];`, indent + 1);
            } else {
                builder.appendLine(`this.__genericArguments = [];`, indent + 1);
            }
            builder.appendLine(`}`, indent);
        }
        emitServiceMethod(builder: CodeBuilder, indent: number, method: Method) {
            let methodContentIndent = indent + 1;
            emitComments(builder, indent, method.Comments);
            if (method.IsGeneric) {
                let genericArugments = method.GenericArguments
                    .map(arg => this.emitType(arg, builder))
                    .join(', ');
                    builder.appendLine(`public ${method.Name}<${genericArugments}>(${this.emitMethodParameters(method.Parameters, builder)}): Observable<${this.emitType(method.ReturnType, builder)}> {`, indent);
                    this.emitMethodContent(builder, methodContentIndent, method);
                    builder.appendLine(`}`, indent);
            } else {
                builder.appendLine(`public ${method.Name}(${this.emitMethodParameters(method.Parameters, builder)}): Observable<${this.emitType(method.ReturnType, builder)}> {`, indent);
                this.emitMethodContent(builder, methodContentIndent, method);
                builder.appendLine(`}`, indent);
            }
        }
        emitMethodContent(builder: CodeBuilder, indent: number, method: Method) {
                    builder.appendMultipleLines(
`return this.__websocketService.send({
    Service: '${this.instance.Fullname.join('.')}',
    Method: '${method.Name}',
    GenericArguments: [],
    Payload: {`, indent);
            for (let i = 0; i < method.Parameters.length; ++i) {
                let parameter = method.Parameters[i];
                builder.appendLine(`${parameter.Name}: ${parameter.Name}${(i < method.Parameters.length - 1) ? ',' : ''}`, indent + 2);
            }
            builder.appendMultipleLines(
`    }
}).pipe(map(__result => {
    return __result.Payload as ${this.emitType(method.ReturnType, builder)};
}));`, indent);
        }
        emitType(typeInstance: Type, builder: CodeBuilder) {
            return CodeGeneration.mapType(typeInstance, builder, this.instance.Fullname);
        }
        emitMethodParameters(parameters: Parameter[], builder: CodeBuilder) {
            return parameters
                .map(parameter => `${emitParameterComments(parameter.Comments)}${parameter.Name}: ${this.emitType(parameter.Type, builder)}`)
                .join(', ');
        }
    }

    class MessageEmitter {
        constructor (private instance: Message) {}
        emitFile(rootDirectory: string) {
            let filename = path.join(rootDirectory, ...this.instance.Namespace, this.instance.Name + '.ts');
            let builder: CodeBuilder = new CodeBuilder(importBuilder);
            let indent = 0;
            this.emitMessage(builder, indent);
            console.log('Write Code to:', filename);
            WriteFile(filename, builder.build(), 'utf-8');
        }
        emitHeritage(builder: CodeBuilder) {
            let baseTypes: string[] = [], interfaces: string[] = [];
            if (this.instance.Base) {
                baseTypes.push(this.emitType(this.instance.Base, builder));
            }
            if (Array.isArray(this.instance.Implementations)) {
                for (let implementation of this.instance.Implementations) {
                    interfaces.push(this.emitType(implementation, builder));
                }
            }
            let result: string = ''
            if (baseTypes.length > 0) {
                result += ` extends ${baseTypes.join(', ')}`;
            }
            if (interfaces.length > 0) {
                result += ` implements ${interfaces.join(', ')}`;
            }
            return result;
        }
        emitMessage(builder: CodeBuilder, indent: number) {
            emitComments(builder, indent, this.instance.Comments);
            let heritage = this.emitHeritage(builder);
            if (this.instance.IsGeneric) {
                let genericArugments = this.instance.GenericArguments
                    .map(arg => this.emitType(arg, builder))
                    .join(', ');
                builder.appendLine(`export class ${this.instance.Name} <${genericArugments}>${heritage}`, indent);
            } else {
                builder.appendLine(`export class ${this.instance.Name}${heritage}`, indent);
            }
            builder.appendLine(`{`, indent);
            let fullname = this.instance.Fullname.join('.');
            builder.appendLine(`__reflection: string = '${fullname}';`, indent + 1);
            builder.appendLine(`__new?: boolean;`, indent + 1);
            builder.appendLine(`__changed?: boolean;`, indent + 1);
            builder.appendLine(`__snapshot?: ${this.instance.Name};`, indent + 1);
            for (let property of this.instance.Properties) {
                this.emitProperty(builder, indent + 1, property);
            }
            builder.appendLine(`}`, indent);
        }
        emitProperty(builder: CodeBuilder, indent: number, property: Property) {
            emitComments(builder, indent, property.Comments);
            builder.appendLine(`${property.Name}: ${this.emitType(property.Type, builder)};`, indent);
        }
        emitType(typeInstance: Type, builder: CodeBuilder) {
            return CodeGeneration.mapType(typeInstance, builder, this.instance.Fullname);
        }
    }

    class ServiceInterfaceEmitter {
        constructor(private instance: ServiceInterface) {}
        emitFile(rootDirectory: string) {
            let filename = path.join(rootDirectory, ...this.instance.Namespace, this.instance.Name + '.ts');
            let builder: CodeBuilder = new CodeBuilder(importBuilder);
            let indent = 0;
            builder.addHierarchicalImport('rxjs', 'Observable');
            this.emitServiceInterface(builder, indent);
            console.log('Write Code to:', filename);
            WriteFile(filename, builder.build(), 'utf-8');
        }
        emitHeritage(builder: CodeBuilder) {
            let baseTypes: string[] = [];
            if (this.instance.Base) {
                baseTypes.push(this.emitType(this.instance.Base, builder));
            }
            if (baseTypes.length == 0) return '';
            else return ` extends ${baseTypes.join(', ')}`;
        }
        emitServiceInterface(builder: CodeBuilder, indent: number) {
            builder.addImport('System');
            builder.addImport('System.Collections.Generic');
            builder.addImport('UniRpc.WebApplication');
            emitComments(builder, indent, this.instance.Comments);
            let heritage = this.emitHeritage(builder);
            if (this.instance.IsGeneric) {
                let genericArugments = this.instance.GenericArguments
                    .map(arg => this.emitType(arg, builder))
                    .join(', ');
                builder.appendLine(`export interface ${this.instance.Name}<${genericArugments}>${heritage}`, indent);
            } else {
                builder.appendLine(`export interface ${this.instance.Name}${heritage}`, indent);
            }
            builder.appendLine(`{`, indent);
            for (let method of this.instance.Methods) {
                this.emitServiceMethod(builder, indent + 1, method);
            }
            builder.appendLine(`}`, indent);
        }
        emitServiceMethod(builder: CodeBuilder, indent: number, method: Method) {
            emitComments(builder, indent, method.Comments);
            if (method.IsGeneric) {
                let genericArugments = method.GenericArguments
                    .map(arg => this.emitType(arg, builder))
                    .join(', ');
                    builder.appendLine(`${method.Name}<${genericArugments}>(${this.emitMethodParameters(method.Parameters, builder)}): Observable<${this.emitType(method.ReturnType, builder)}>;`, indent);
            } else {
                builder.appendLine(`${method.Name}(${this.emitMethodParameters(method.Parameters, builder)}): Observable<${this.emitType(method.ReturnType, builder)}>;`, indent);
            }
        }
        emitType(typeInstance: Type, builder: CodeBuilder) {
            return CodeGeneration.mapType(typeInstance, builder, this.instance.Fullname);
        }
        emitMethodParameters(parameters: Parameter[], builder: CodeBuilder) {
            return parameters
                .map(parameter => `${emitParameterComments(parameter.Comments)}${parameter.Name}: ${this.emitType(parameter.Type, builder)}`)
                .join(', ');
        }
    }

    class MessageInterfaceEmitter {
        constructor(private instance: MessageInterface) {}
        emitFile(rootDirectory: string) {
            let filename = path.join(rootDirectory, ...this.instance.Namespace, this.instance.Name + '.ts');
            let builder: CodeBuilder = new CodeBuilder(importBuilder);
            let indent = 0;
            this.emitMessageInterface(builder, indent + 1);
            console.log('Write Code to:', filename);
            WriteFile(filename, builder.build(), 'utf-8');
        }
        emitHeritage(builder: CodeBuilder) {
            let baseTypes: string[] = [];
            if (this.instance.Base) {
                baseTypes.push(this.emitType(this.instance.Base, builder));
            }
            if (baseTypes.length == 0) return '';
            else return ` : ${baseTypes.join(', ')}`;
        }
        emitMessageInterface(builder: CodeBuilder, indent: number) {
            emitComments(builder, indent, this.instance.Comments);
            let heritage = this.emitHeritage(builder);
            if (this.instance.IsGeneric) {
                let genericArugments = this.instance.GenericArguments
                    .map(arg => this.emitType(arg, builder))
                    .join(', ');
                builder.appendLine(`export interface ${this.instance.Name} <${genericArugments}>${heritage}`, indent);
            } else {
                builder.appendLine(`export interface ${this.instance.Name}${heritage}`, indent);
            }
            builder.appendLine(`{`, indent);
            let fullname = this.instance.Fullname.join('.');
            for (let property of this.instance.Properties) {
                this.emitProperty(builder, indent + 1, property);
            }
            builder.appendLine(`}`, indent);
        }
        emitProperty(builder: CodeBuilder, indent: number, property: Property) {
            emitComments(builder, indent, property.Comments);
            builder.appendLine(`public ${property.Name}: ${this.emitType(property.Type, builder)};`, indent);
        }
        emitType(typeInstance: Type, builder: CodeBuilder) {
            return CodeGeneration.mapType(typeInstance, builder, this.instance.Fullname);
        }
    }

    class EnumEmitter {
        constructor(private instance: Enum) {}
        emitFile(rootDirectory: string) {
            let filename = path.join(rootDirectory, ...this.instance.Namespace, this.instance.Name + '.ts');
            let builder: CodeBuilder = new CodeBuilder(importBuilder);
            let indent = 0;
            this.emitEnum(builder, indent);
            console.log('Write Code to:', filename);
            WriteFile(filename, builder.build(), 'utf-8');
        }
        emitEnum(builder: CodeBuilder, indent: number) {
            builder.appendLine(`export enum ${this.instance.Name} {`, indent);
            let size = this.instance.Fields.size;
            let index = 0;
            for (let name of this.instance.Fields.keys()) {
                ++index;
                let delimiter = index == size ? '' : ',';
                let value = this.instance.Fields.get(name);
                if (typeof value == 'string') {
                    builder.appendLine(`${name} = '${value}'${delimiter}`, indent + 1);
                } else if (typeof value == 'number') {
                    builder.appendLine(`${name} = ${value}${delimiter}`, indent + 1);
                }
            }
            builder.appendLine(`}`, indent);
            builder.appendLine('', indent);
        }
    }

    export class ReflectionsEmitter {
        constructor (private namsespaces: Map<string, Namespace>) {}
        emitFile(rootDirectory: string) {
            let filename = path.join(rootDirectory, 'UniRpc/Reflections.ts');
            let builder: CodeBuilder = new CodeBuilder(importBuilder);
            let indent = 0;
            this.emitRelections(builder, indent);
            console.log('Write Code to:', filename);
            WriteFile(filename, builder.build(), 'utf-8');
        }
        emitRelections(builder: CodeBuilder, indent: number) {
            builder.appendLine(`class Reflections extends ${this.emitType(reflectionsBaseType, builder)} {`, indent);
            builder.appendLine(`constructor() {`, indent + 1);
            builder.appendLine(`super();`, indent + 2);
            for (let instance of this.namsespaces.values()) {
                for (let message of instance.Messages.values()) {
                    builder.appendLine(`this.Register({`, indent + 2);
                    builder.appendLine(`Name: '${message.Fullname.join('.')}',`, indent + 3);
                    if (message.Base && message.Base.Reference) {
                        builder.appendLine(`Base: '${message.Base.Reference.FullName.join('.')}',`, indent + 3);
                    }
                    if (message.Properties.length == 0) {
                        builder.appendLine(`Properties: [],`, indent + 3);
                    } else {
                        builder.appendLine(`Properties: [`, indent + 3);
                        for (let index = 0; index < message.Properties.length; ++index) {
                            let property = message.Properties[index];
                            builder.appendLine(`{`, indent + 4);
                            builder.appendLine(`Name: '${property.Name}',`, indent + 5);
                            builder.appendLine(`Type: '${this.emitReflectionType(property.Type)}'`, indent + 5);
                            builder.appendLine(`}${(index < message.Properties.length - 1 ? ',': '')}`, indent + 4);
                        }
                        builder.appendLine(`],`, indent + 3);
                    }
                    if (message.GenericArguments.length == 0) {
                        builder.appendLine(`GenericArguments: []`, indent + 3);
                    } else {
                        builder.appendLine(`GenericArguments: [`, indent + 3);
                        for (let index = 0; index < message.GenericArguments.length; ++index) {
                            let genericArgument = message.GenericArguments[index];
                            builder.appendLine(`'${genericArgument.Name}'`, indent + 4);
                        }
                        builder.appendLine(`]`, indent + 3);
                    }
                    builder.appendLine(`});`, indent + 2);
                }
            }
            builder.appendLine(`}`, indent + 1);
            builder.appendLine(`}`, indent);
            builder.appendLine(``, indent);
            builder.appendLine(`export const MessageReflections = new Reflections();`, indent);
        }
        emitType(typeInstance: Type, builder: CodeBuilder) {
            return CodeGeneration.mapType(typeInstance, builder, ['UniRpc', 'Reflections']);
        }
        emitReflectionType(typeInstance: Type): string {
            if (typeInstance.IsGeneric) {
                return `${typeInstance.FullName.join('.')}<${typeInstance.GenericArguments.map(genericArgumentType => this.emitReflectionType(genericArgumentType)).join(',')}>`;
            } else {
                return typeInstance.Reference.FullName.join('.');
            }
        }
    }

    export class GroupAuthorizationsEmitter {
        keys: string[] = [];
        constructor (private groups: Map<string, GroupManagement>) {}
        emitFile(rootDirectory: string){
            let filename = path.join(rootDirectory, 'UniRpc/GroupAuthorizationPolicies.ts');
            let builder: CodeBuilder = new CodeBuilder(importBuilder);
            let indent = 0;
            builder.appendLine(`import { Router } from '@angular/router';`, indent);
            builder.appendLine(`import { GuardBase } from './GroupAuthorizations';`, indent);
            builder.appendLine(`import { TokenHolder } from './token-holder.service';`, indent);
            builder.appendLine(`import { Injectable } from "@angular/core";`, indent);
            this.emitAnyGroupPolicy(builder, indent);
            for (let key of this.groups.keys()) {
                this.keys.push(key);
            }
            this.keys.sort();
            for (let key of this.keys) {
                let group = this.groups.get(key);
                this.emitGroupPolicy(builder, indent, group);
            }
            this.emitPolicySets(builder, indent);
            console.log('Write Code to:', filename);
            WriteFile(filename, builder.build(), 'utf-8');
        }
        emitAnyGroupPolicy(builder: CodeBuilder, indent: number) {
            builder.appendLine(`@Injectable({providedIn: 'root'})`, indent);
            builder.appendLine(`export class __AnyGroupGuard extends GuardBase {`, indent);
            ++indent;
            builder.appendLine(`constructor(public token: TokenHolder, public router: Router) {`, indent);
            builder.appendLine(`super(token, router);`, indent + 1);
            builder.appendLine(`}`, indent);
            builder.appendLine(`check = () => {`, indent);
            builder.appendLine(`return (this.token.Access && (this.token.Expires >= Date.now()) && this.token.Groups.length > 0) ? true : false;`, indent + 1);
            builder.appendLine(`};`, indent);
            --indent;
            builder.appendLine(`}`, indent);
        }
        emitGroupPolicy(builder: CodeBuilder, indent: number, group: GroupManagement) {
            builder.appendLine(`export enum ${group.Name} {`, indent)
            ++indent;
            for (let member of group.Members) {
                builder.appendLine(`${member} = '${member}',`, indent)
            }
            --indent;
            builder.appendLine(`}`, indent);
            builder.appendLine(`export module ${group.Name} {`, indent);
            ++indent;
            {
                builder.appendLine(`@Injectable({providedIn: 'root'})`, indent);
                builder.appendLine(`export class __AnyGuard extends GuardBase {`, indent);
                ++indent;
                builder.appendLine(`Name: string = '${group.Name}.';`, indent);
                builder.appendLine(`constructor(public token: TokenHolder, public router: Router) {`, indent);
                builder.appendLine(`super(token, router);`, indent + 1);
                builder.appendLine(`}`, indent);
                builder.appendLine(`check = () => {`, indent);
                builder.appendLine(`return (this.token.Access && (this.token.Expires >= Date.now()) && this.token.Groups.reduce((value, group) => value || group.startsWith(this.Name), false)) ? true : false;`, indent + 1);
                builder.appendLine(`};`, indent);
                --indent;
                builder.appendLine(`}`, indent);
            }
            for (let member of group.Members) {
                builder.appendLine(`@Injectable({providedIn: 'root'})`, indent);
                builder.appendLine(`export class ${member}Guard extends GuardBase {`, indent);
                ++indent;
                builder.appendLine(`Name: string = '${group.Name}.${member}';`, indent);
                builder.appendLine(`constructor(public token: TokenHolder, public router: Router) {`, indent);
                builder.appendLine(`super(token, router);`, indent + 1);
                builder.appendLine(`}`, indent);
                builder.appendLine(`check = () => {`, indent);
                builder.appendLine(`return (this.token.Access && (this.token.Expires >= Date.now()) && this.token.Groups.includes(this.Name)) ? true : false;`, indent + 1);
                builder.appendLine(`};`, indent);
                --indent;
                builder.appendLine(`}`, indent);
            }
            --indent;
            builder.appendLine(`}`, indent);
        }
        emitPolicySets(builder: CodeBuilder, indent: number) {
            builder.appendLine(`export const __PolicySets = {`, indent);
            let keysSize = this.keys.length;
            let contentIndent = indent + 1;
            let keyIndex = 0;
            for (let key of this.keys) {
                ++keyIndex;
                let comma = keyIndex < keysSize ? ',' : '';
                builder.appendLine(`${key}: ${key}${comma}`, contentIndent);
            }
            builder.appendLine(`};`, indent)
        }
    }


}