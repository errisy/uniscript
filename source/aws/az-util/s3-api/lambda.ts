import {S3, AWSError} from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';

async function group(s3: S3, path: string, pattern: string, flags: string, threshold: number, items: {Key: string, Pattern: string, Flags: string}[]): Promise<string[]>{
    var matches = /^[sS]3:\/{2}([a-z_\d\-]{3,63})\/([\w\d_\-\.\(\),\/ ]+)$/gi.exec(path);
    let listObjectsV2Request: S3.ListObjectsV2Request = <any> {};
    listObjectsV2Request.Bucket = matches[1];
    listObjectsV2Request.Prefix = matches[2];
    var listed: PromiseResult<S3.ListObjectsV2Output, AWSError>;
    let ptn = new RegExp(pattern, flags);
    var keys: {[key: string]: {Count: number, Items:{[key:string]: boolean}}} = {};
    do{
        listed = await (s3.listObjectsV2(listObjectsV2Request).promise());
        for(let obj of listed.Contents){
            let match = ptn.exec(obj.Key);
            ptn.lastIndex = undefined;
            if(!keys[match[1]]) keys[match[1]] = {Count: 0, Items: {}};
            if(!match) continue;
            let keyData = keys[match[1]];
            keyData.Count++;
            if(!Array.isArray(items)) continue;
            for(let item of items){
                let itemMatch = (new RegExp(item.Pattern, item.Flags)).exec(obj.Key);
                if(!itemMatch) continue;
                keyData.Items[item.Key] = true;
            }
        }
    }while(listObjectsV2Request.ContinuationToken = listed.NextContinuationToken);
    let groups: string[] = [];
    for(let key in keys){
        let keyData = keys[key];
        if(keyData.Count < threshold) continue;
        if(Array.isArray(items)){
            let failed: boolean = false;
            for(let item of items){
                if(!keyData.Items[item.Key]){
                    failed = true;
                    break;
                }
            }
            if(failed) continue;
        }
        groups.push(key)
    }
    return groups;
}

async function count(s3: S3, path: string){
    var matches = /^[sS]3:\/{2}([a-z_\d\-]{3,63})\/([\w\d_\-\.\(\),\/ ]+)$/gi.exec(path);
    let listObjectsV2Request: S3.ListObjectsV2Request = <any> {};
    listObjectsV2Request.Bucket = matches[1];
    listObjectsV2Request.Prefix = matches[2];
    var listed: PromiseResult<S3.ListObjectsV2Output, AWSError>;
    var numberOfObjects: number = 0;
    do{
        listed = await (s3.listObjectsV2(listObjectsV2Request).promise());
        numberOfObjects += listed.Contents.length;
    }while(listObjectsV2Request.ContinuationToken = listed.NextContinuationToken);
    return numberOfObjects;
}

async function remove (s3: S3, path: string){
    var matches = /^[sS]3:\/{2}([a-z_\d\-]{3,63})\/([\w\d_\-\.\(\),\/ ]+)$/gi.exec(path);
    let listObjectsV2Request: S3.ListObjectsV2Request = <any> {};
    listObjectsV2Request.Bucket = matches[1];
    listObjectsV2Request.Prefix = matches[2];
    var listed: PromiseResult<S3.ListObjectsV2Output, AWSError>;
    var objects = [];
    do{
        listed = await (s3.listObjectsV2(listObjectsV2Request).promise());
        objects.push(...(listed.Contents.map(s3obj => s3obj.Key)));
    }while(listObjectsV2Request.ContinuationToken = listed.NextContinuationToken);
    let count = objects.length;
    let deleteObjectsRequest: S3.DeleteObjectsRequest = <any>{};
    deleteObjectsRequest.Bucket = matches[1];
    while(objects.length > 0){
        let upto1000 = objects.splice(0, 1000);
        deleteObjectsRequest.Delete = { Objects: upto1000.map(obj => {
            return { Key: obj };
        }) };
        await (s3.deleteObjects(deleteObjectsRequest).promise());
    }
    return count;
}

async function copy (s3: S3, source: string, dest: string, namePrefix: string, nameSuffix){
    // console.log('source: ', source, 'dest:', dest);
    let sourceMatches = /^[sS]3:\/{2}([a-z_\d\-]{3,63})\/([\w\d_\-\.\(\),\/ ]+)$/gi.exec(source);
    let destinationMatches = /^[sS]3:\/{2}([a-z_\d\-]{3,63})\/([\w\d_\-\.\(\),\/ ]+)$/gi.exec(dest);
    let sourceBucket = sourceMatches[1], destinationBucket = destinationMatches[1],
        sourcePrefix = sourceMatches[2], desitnationPrefix = destinationMatches[2];
    // console.log(sourceBucket, sourcePrefix);
    // console.log(destinationBucket, desitnationPrefix);
    let listObjectsV2Request: S3.ListObjectsV2Request = <any> {};
    listObjectsV2Request.Bucket = sourceBucket;
    listObjectsV2Request.Prefix = sourcePrefix;
    var listed: PromiseResult<S3.ListObjectsV2Output, AWSError>;
    var s3Objects: string[] = [];
    do{
        listed = await (s3.listObjectsV2(listObjectsV2Request).promise());
        s3Objects.push(...(listed.Contents.map(s3obj => `s3://${sourceBucket}/${s3obj.Key}`)));
    }while(listObjectsV2Request.ContinuationToken = listed.NextContinuationToken);
    for(let s3Object of s3Objects){
        let destination = s3Object.replace(`s3://${sourceBucket}/${sourcePrefix}`, `s3://${destinationBucket}/${desitnationPrefix}`);
        let matches = /^[sS]3:\/{2}([a-z_\d\-]{3,63})\/([\w\d_\-\.\(\),\/ ]+)$/gi.exec(destination);
        let key = matches[2];
        if(namePrefix){
            let lastSlash = key.lastIndexOf('/');
            if(lastSlash >= 0){
                key = key.substring(0, lastSlash + 1) + namePrefix + key.substr(lastSlash + 1);
            }
            else{
                key = namePrefix + key;
            }
        }
        if(nameSuffix) key += nameSuffix;
        let request: S3.CopyObjectRequest  = {
            Bucket: matches[1],
            Key: key,
            CopySource: encodeURIComponent(s3Object.substr(5)),
        };
        await (s3.copyObject(request).promise());
    }
    return s3Objects.length;
}

interface IEvent{
    List: string[];
    Copy: {Source: string, Destination: string, NamePrefix: string, NameSuffix: string}[];
    Remove: string[];
    /** this will identify the group of file with same patterns */
    Group: {Path: string, Pattern: string, Flags: string, Threshold: number, Items: {Key: string, Pattern: string, Flags: string}[]}[];
    Profile?: string;
}

export async function handler (event: IEvent) {
    let options: S3.ClientConfiguration = eval(`(${process.env[event.Profile]})`);
    // console.log('options ->', options);
    let s3 = event.Profile ? new S3(options) : new S3();
    if(Array.isArray(event.Group)){
        let results: string[] = [];
        for(let g of event.Group){
            let groups = await group(s3, g.Path, g.Pattern, g.Flags, g.Threshold, g.Items);
            results.push(...groups);
        }
        return results;
    }
    else{
        let listCount = 0, copyCount = 0, removeCount = 0;
        if(Array.isArray(event.List)){
            for(let path of event.List){
                try{
                    listCount += await count(s3, path);
                }
                catch(ex){
                    throw ex;
                }
            }
            console.log(`${listCount} Objects Exist.`);
        }
        console.log('input:', event);

        if(Array.isArray(event.Copy)){
            for(let path of event.Copy){
                try{
                    copyCount += await copy(s3, path.Source, path.Destination, path.NamePrefix, path.NameSuffix);
                }
                catch(ex){
                    throw ex;
                }
            }
            console.log(`${copyCount} Objects Copied.`);
        }
        if(Array.isArray(event.Remove)){
            for(let path of event.Remove){
                try{
                    removeCount += await remove(s3, path);
                }
                catch(ex){
                    throw ex;
                }
            }
            console.log(`${removeCount} Objects Removed.`);
        }
        return [String(listCount + copyCount + removeCount)];
    }
};
