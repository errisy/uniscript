export class ReflectionType {
    Name: string;
    Fullname: string;
    GenericArguments: ReflectionType[];
}

export class MessageProperty {
    Name: string;
    Type: string;
}

export class Reflection {
    Name: string;
    Properties: MessageProperty[];
    GenericArguments: string[];
}

export class ReflectionsBase {

    Messages: Map<string, Reflection> = new Map();

    Register(reflection: Reflection) {
        this.Messages.set(reflection.Name, reflection);
    }

    Compare<T>(a: T, b: T): boolean {
        if (a === null && b === null) return true;
        let aType = typeof a, bType = typeof b;
        if (aType != bType) return false;
        switch (aType) {
            case 'undefined': return true;
            case 'string':
            case 'number':
            case 'boolean':
                return a == b;
            case 'object':
                let aIsArray = Array.isArray(a), bIsArray = Array.isArray(b);
                if (aIsArray && bIsArray) {
                    let aArray = a as any as any[], bArray = b as any as any[];
                    if (aArray.length != bArray.length) return false;
                    for (let i = 0; i < aArray.length; ++i) {
                        if (!this.Compare(aArray[i], bArray[i])) return false;
                    }
                    return true;
                } else if((aIsArray && !bIsArray) || (!aIsArray && bIsArray)) {
                    return false;
                } else {
                    let a__reflection = (a as any)['__reflection'], b__reflection = (b as any)['__reflection'];
                    let a__reflectionIsString = typeof a__reflection == 'string', b__reflectionIsString = typeof b__reflection == 'string';
                    if (a__reflectionIsString && b__reflectionIsString) {
                        if (a__reflection != b__reflection) return false;
                        return this.CompareType(a, b, a__reflection);
                    } else if ((a__reflectionIsString && !b__reflectionIsString) || (!a__reflectionIsString && b__reflectionIsString)) {
                        return false;
                    } else {
                        let compared: Set<string> = new Set();
                        for (let key in a) {
                            if (compared.has(key)) continue;
                            if (!this.Compare(a[key], b[key])) return false;
                            compared.add(key);
                        }
                        for (let key in b) {
                            if (compared.has(key)) continue;
                            if (!this.Compare(a[key], b[key])) return false;
                            compared.add(key);
                        }
                        return true;
                    }
                }
            default:
                throw new Error(`Reflections.Compare does not support type "${aType}".`);
        }
        return true;
    }

    CompareType<T>(a: T, b: T, __reflection: string): boolean {
        let reflectionType = this.ParseReflection(__reflection) as ReflectionType;
        switch (reflectionType.Name) {
            case 'boolean':
            case 'string':
            case 'float':
            case 'double':
            case 'integer':
            case 'long':
            case 'bytes':
                return a == b;
            case 'Array': 
            case 'List':
                let aIsArray = Array.isArray(a), bIsArray = Array.isArray(b);
                if (aIsArray && bIsArray) {
                    let aArray = a as any as any[], bArray = b as any as any[];
                    if (aArray.length != bArray.length) return false;
                    for (let i = 0; i < aArray.length; ++i) {
                        if (!this.CompareType(aArray[i], bArray[i], reflectionType.GenericArguments[0].Fullname)) return false;
                    }
                    return true;
                } else {
                    let message: string[] = [];
                    if (!aIsArray) {
                        message.push(`Left value is neither Array or List;`);
                    }
                    if (!bIsArray) {
                        message.push(`Right value is neither Array or List;`);
                    }
                    throw new Error(message.join(' '));
                }
            case 'Dict':
                let result: T = {} as any;
                let aDict: {[key: string]: any} = a as any, bDict: {[key: string]: any} = b as any;
                let compared: Set<string> = new Set();
                for (let key in aDict) {
                    if (compared.has(key)) continue;
                    if (!this.CompareType((a as any)[key], (b as any)[key], reflectionType.GenericArguments[1].Fullname)) return false;
                    compared.add(key);
                }
                for (let key in bDict) {
                    if (compared.has(key)) continue;
                    if (!this.CompareType((a as any)[key], (b as any)[key], reflectionType.GenericArguments[1].Fullname)) return false;
                    compared.add(key);
                }
                return true;
            default:
                let a__reflection = (a as any)['__reflection'], b__reflection = (b as any)['__reflection'];
                if ((a__reflection != reflectionType.Name) || (b__reflection != reflectionType.Name)) {
                    let message: string[] = [];
                    if (a__reflection != reflectionType.Name) {
                        message.push(`Left value is not type "${reflectionType.Name}";`);
                    }
                    if (b__reflection != reflectionType.Name) {
                        message.push(`Right value is not type "${reflectionType.Name}";`);
                    }
                    throw new Error(message.join(' '));
                } else {
                    let reflection = this.Messages.get(reflectionType.Name) as Reflection;
                    for (let property of reflection.Properties) {
                        if (!this.CompareType((a as any)[property.Name], (b as any)[property.Name], property.Type)) return false;
                    }
                    return true;
                }
        }
    }

    DetectChanges<T>(value: T): boolean {
        let changed = !this.Compare(value, (value as any)['__snapshot']);
        if (changed) {
            (value as any)['__changed'] = true;
        } else {
            delete (value as any)['__changed'];
        }
        return changed;
    }

    New<T>(__Class: { new(): T }): T {
        let instance = new __Class();
        if (!('__reflection' in instance)) {
            throw new Error(`Invalid Class "${__Class}". No "__reflection" found.`);
        }
        let __reflection = (instance as any)['__reflection'];
        return this.NewType<T>(__reflection);
    }

    NewType<T>(__reflection: string, genericArguments?: string[]): T {
        let reflectionType = this.ParseReflection(__reflection) as ReflectionType;
        if (!this.Messages.has(reflectionType.Name)) {
            throw new Error(`Type "${reflectionType.Name}" is not registered in Reflections.Messages.`);
        }
        let reflection = this.Messages.get(reflectionType.Name) as Reflection;
        let genericTypeMappings: Map<string, string> = new Map();
        if (Array.isArray(reflection.GenericArguments) && reflection.GenericArguments.length > 0) {
            if (!Array.isArray(genericArguments)) {
                throw new Error(`No generic arguments are provided for type "${reflection.Name}".`);
            }
            let missingArguments: string[] = [];
            for (let index = 0; index < reflection.GenericArguments.length; ++index) {
                if (typeof genericArguments[index] == 'string') {
                    genericTypeMappings.set(reflection.GenericArguments[index], genericArguments[index]);
                } else {
                    missingArguments.push(`"${reflection.GenericArguments[index]}"`);
                }
            }
            if (missingArguments.length > 0) {
                throw new Error(`Generic argument mappings are not found for ${missingArguments.join(', ')}.`);
            }
        }
        let instance: T = {
            '__reflection': __reflection
        } as any;
        for (let property of reflection.Properties) {
            if (genericTypeMappings.has(property.Type)) {
                (instance as any)[property.Name] = this.NewProperty(genericTypeMappings.get(property.Type) as string);
            } else {
                (instance as any)[property.Name] = this.NewProperty(property.Type);
            }
        }
        return instance;
    }

    NewProperty(__reflection: string): any {
        let reflectionType = this.ParseReflection(__reflection) as ReflectionType;
        switch (reflectionType.Name) {
            case 'integer':
            case 'long':
            case 'float':
            case 'double':
                return 0;
            case 'string':
                return '';
            case 'boolean':
                return false;
            case 'Array':
            case 'List':
                return [];
            case 'Dict':
                return {};
            default:
                return this.NewType(reflectionType.Fullname, reflectionType.GenericArguments.map(genericArgument => genericArgument.Fullname));
        }
    }
    
    Snapshot<T>(value: T): T {
        (value as any)['__snapshot'] = this.Clone(value);
        delete (value as any)['__new'];
        delete (value as any)['__changed'];
        return (value as any)['__snapshot'];
    }

    Clone<T>(value: T): T {
        if (value === null) return null as any;
        let valueType = typeof value;
        switch (valueType) {
        case 'undefined':
        case 'number':
        case 'string':
        case 'boolean':
            return value;
        case 'object':
            let __reflection = (value as any)['__reflection'];
            if (this.Messages.has(__reflection)) {
                return this.CloneType(value, __reflection) as any;
            } else if (Array.isArray(value)) {
                return [...value] as any;
            } else {
                return {...value} as any;
            }
        }
        throw new Error(`Invalid Value Type to Clone: ${value}`);
    }

    CloneType<T>(value: T, __reflection: string): T {
        let reflectionType = this.ParseReflection(__reflection) as ReflectionType;
        switch (reflectionType.Name) {
            case 'boolean':
            case 'string':
            case 'float':
            case 'double':
            case 'integer':
            case 'long':
            case 'bytes':
                return value;
            case 'Array': 
            case 'List':
                if (value == undefined) return undefined as any;
                return ((value as any) as any[]).map(item => this.CloneType(item, reflectionType.GenericArguments[0].Fullname)) as any;
            case 'Dict':
                if (value == undefined) return undefined as any;
                let result: T = {} as any;
                let dict: {[key: string]: any} = value as any;
                for (let key in dict) {
                    let item = dict[key];
                    (result as any)[key] = this.CloneType(item, reflectionType.GenericArguments[1].Fullname);
                }
                return result;
            default:
                if (value == undefined) return undefined as any;
                if (!this.Messages.has(reflectionType.Name)) {
                    throw new Error(`Type "${reflectionType.Name}" is not registered in Reflections.Messages.`);
                }
                let reflection = this.Messages.get(reflectionType.Name) as Reflection;
                let clone: T = {
                    '__reflection': __reflection
                } as any;
                for (let property of reflection.Properties) {
                    (clone as any)[property.Name] = this.CloneType((value as any)[property.Name], property.Type);
                }
                return clone;
        }
    }

    ParseGenericArguments(__sections: string): ReflectionType[] {
        let counter = 0, start = 0;
        let reflectionTypes: ReflectionType[] = [];
        let reflectionType: ReflectionType | null;
        for (let i = 0; i < __sections.length; ++i) {
            let char = __sections.charAt(i);
            switch (char) {
                case ',':
                    if (counter == 0) {
                        start = i + 1;
                    }  
                    break;
                case '<':
                    ++counter;
                    break;
                case '>':
                    --counter;
                    if (counter == 0) {
                        if (reflectionType = this.ParseReflection(__sections.substring(start, i + 1))) {
                            reflectionTypes.push(reflectionType);
                        }
                        start = i + 1;
                    }
                    break;
            }
        }
        if (reflectionType = this.ParseReflection(__sections.substring(start, __sections.length))) {
            reflectionTypes.push(reflectionType);
        }
        return reflectionTypes;
    }
    
    ParseReflection(__reflection: string): ReflectionType | null {
        __reflection = __reflection.replace(/ /ig, '');
        if (__reflection.length == 0) return null;
        let groups: RegExpExecArray | null = /^(\w+)<([\w<>,]+)>$/ig.exec(__reflection);
        if (groups) {
            return {
                Name: groups[1],
                Fullname: __reflection,
                GenericArguments: this.ParseGenericArguments(groups[2])
            };
        } else {
            return {
                Name: __reflection,
                Fullname: __reflection,
                GenericArguments: []
            };
        }
    }
}

