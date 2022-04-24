import * as fs from 'fs';



declare let $: {[key:string]: any};

let outputs: string[] = $['__command_output__'].split('\n');
let excludings: string = $['excludings'].split(',');

let filesByExtension: Map<string, number> = new Map();
let linesByExtension: Map<string, number> = new Map();
let totalFileCount: number = 0;
let totalLineCount: number = 0;
let maxExtensionLength: number = 0;

function shouldExclude(file: string): boolean {
    for (let excluding of excludings) {
        if (new RegExp(excluding, 'ig').test(file)) return true;
    }
    return false;
}

for (let file of outputs) {
    if (!fs.existsSync(file)) continue;
    if (shouldExclude(file)) continue;
    totalFileCount += 1;
    let lastDot = file.lastIndexOf('.');
    let fileContent = fs.readFileSync(file, { encoding: 'utf-8'});
    let lineCount = fileContent.split('\n').filter(line => line.replace(/\s+/, '')).length;
    totalLineCount += lineCount;
    if (lastDot >= 0) {
        let extension =  file.substring(lastDot + 1);
        maxExtensionLength = Math.max(maxExtensionLength, extension.length);
        if (filesByExtension.has(extension)) {
            filesByExtension.set(extension, filesByExtension.get(extension) + 1);
        } else {
            filesByExtension.set(extension, 1);
        }
        if (linesByExtension.has(extension)) {
            linesByExtension.set(extension, linesByExtension.get(extension) + lineCount);
        } else {
            linesByExtension.set(extension, 1);
        }
    }
}

console.log(`\x1b[34m${'Extension'.padStart(maxExtensionLength, ' ')} ${'Files'.padStart(12, ' ')} ${'Lines'.padStart(12, ' ')}`);
for (let extension of filesByExtension.keys()) {
    console.log(`\x1b[33m${extension.padStart(maxExtensionLength, ' ')} ${filesByExtension.get(extension).toString().padStart(12, ' ')} ${linesByExtension.get(extension).toString().padStart(12, ' ')}`);
}

console.log(`\x1b[35m${'*Total*'.padStart(maxExtensionLength, ' ')} ${totalFileCount.toString().padStart(12, ' ')} ${totalLineCount.toString().padStart(12, ' ')}`);

console.log('\x1b[37m');

console.log('excludings:', excludings);