import * as fs from 'fs';
import * as yaml from 'yaml';
import * as path from 'path';

declare let $: {[key:string]: any};

declare class WebMethod {
    method: 'get' | 'head'  | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace' | 'patch';
    url: string;
    headers: object;
    from: string;
    fromFile: string;
    fromFileBinary: boolean;
    fromContent: string;
    to: string;
    toType: 'string' | 'json' | 'yaml' | 'number' | 'boolean';
    toFile: string;
    toFileBinary: boolean;
    fromFormat: boolean;
    toFormat: boolean;
    
    /** Interal use only */
    fromField: 'from' | 'fromFile' | 'fromContent';
    /** Interal use only */
    toField: 'to' | 'toFile';
}

declare class FileMethod {
    s?: string;
    src?: string;
    source?: string;
    d?: string;
    dst?: string;
    destination?: string;
    c?: string[];
    cp?: string[];
    copy?: string[];
    f?: string[];
    fmt?: string[];
    format?: string[];
}

declare class ScriptNode {
    name: string;
    web?: WebMethod;
    file?: FileMethod;
}

declare class ScriptRunner {
    parameters: {[key: string]: any};
    steps: ScriptNode[];
}

let scanPath = $['scanPath'];
let outputScriptFile = $['outputScriptFile'];
let defaultFormatting = $['defaultFormatting'];

async function IsDir(itemPath: string): Promise<boolean> {
    if (!fs.existsSync(itemPath)) return false;
    let stat = await fs.promises.stat(itemPath);
    return stat.isDirectory();
}

async function IsFile(itemPath: string): Promise<boolean> {
    if (!fs.existsSync(itemPath)) return false;
    let stat = await fs.promises.stat(itemPath);
    return stat.isFile();
}

async function ScanPath(itemPath: string): Promise<ScriptRunner> {
    let file: FileMethod = {
        source: '@{baseUrl}'
    };
    let files: string[] = [];
    let runner: ScriptRunner = {
        parameters: {
            'baseUrl$': ''
        },
        steps: [
            {
                name: 'get files',
                file: file
            }
        ]
    };
    await ScanDirectory(itemPath, files);
    if (Boolean(defaultFormatting)) {
        file.format = files;
    } else {
        file.copy = files;
    }
    return runner;
}

/** DFS approach to scan the whole folder */
async function ScanDirectory(itemPath: string, files: string[]): Promise<void> {
    let results = await fs.promises.readdir(itemPath);
    for (let result of results) {
        let fullPath = [itemPath, result].join('/');
        if (await IsFile(fullPath)) {
            let suffix = `${itemPath}/${result}`;
            if (suffix.startsWith('./')) suffix = suffix.substring(2);
            files.push(suffix);
        } else if (await IsDir(fullPath)) {
            if (result == 'node_modules') continue;
            await ScanDirectory(fullPath, files);
        }
    }
}

async function Main() {
    try{
        if (typeof scanPath == 'undefined') {
            scanPath = '.';
        } else if (typeof scanPath == 'string' && scanPath == '') {
            scanPath = '.';
        }
        let runner = await ScanPath(scanPath);
        await fs.promises.writeFile(outputScriptFile, yaml.stringify({script: runner}), { encoding: 'utf-8' });
    } catch (ex) {
        console.log('Error:', ex);
    }
    
}

(async () => await Main())();