import { CloudFront } from 'aws-sdk';

interface IEvent{
    Action: 'Invalidate';
    DistributionId: string;
    Paths: string[];
}

function Timestamp(){
    let now = new Date();
    return `${now.getUTCFullYear()}${now.getUTCMonth()}${now.getUTCDate()}${now.getUTCHours()}${now.getUTCMinutes}${now.getUTCSeconds}`;
}

function GenerateId(length: number){
    let result: string = '';
    for(let i = 0; i < length; i++){
        result += Math.floor(Math.random() * 36).toString(36);
    }
    return result; 
}

export async function handler (event: IEvent) {
    switch(event.Action){
        case 'Invalidate':{
            let cdn = new CloudFront();
            await (cdn.createInvalidation({
                DistributionId: event.DistributionId,
                InvalidationBatch: {
                    CallerReference: `${Timestamp()}-${GenerateId(6)}`,
                    Paths: {
                        Quantity: event.Paths.length,
                        Items: event.Paths
                    }
                }
            }).promise());
        }
        break;
    }
    return {
        'status': 200
    };
};
