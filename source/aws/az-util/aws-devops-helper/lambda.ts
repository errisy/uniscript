import { Lambda, SQS, DynamoDB, CloudFormation } from 'aws-sdk';

interface IEvent{
    query: 'LambdaLayer' | 'CloudFormationState' | 'BatchTaskDefinition' | 'BuildComplete' | 'BuildSubscribe';
    name: string;
    subscriptions: string[]; // [Organization].[Project].[Repository]
}

export async function handler (event: IEvent) {
    switch(event.query){
        case 'LambdaLayer':{
            let sections = event.name.split('@@@');
            let region = sections[0];
            let name = sections[1];
            let lambda = new Lambda({region: region});
            let response = await (lambda.listLayerVersions({LayerName: name}).promise());
            let count = response.LayerVersions.length;
            return response.LayerVersions[count - 1].LayerVersionArn;
        }
        case 'CloudFormationState':{
            let cloudForamtion = new CloudFormation();
            let response = await (cloudForamtion.describeStacks({
                StackName: event.name
            }).promise());
            if(!Array.isArray(response.Stacks)) return 'n/a'; // in case stack does not exist
            if(response.Stacks.length == 0) return 'n/a'; // in case stack does not exist
            if(response.Stacks[0].StackStatus == 'CREATE_COMPLETE' || response.Stacks[0].StackStatus == 'UPDATE_COMPLETE') return 'n/a'; // in case stack is in good condition
            return "true"; // return true when we should delete the stack first
        }
        case 'BuildComplete':{
            let queueUrl: string = process.env['BuildScheduleQueue'];
            let subscriptionTable: string = process.env['BuildSubscriptionTable'];
            let dynamoDB = new DynamoDB();
            // get subscription
            let sections = event.name.split('@@@');
            let source = `${sections[0]}@@@${sections[1]}@@@${sections[2]}`
            let targetsResponse = await (dynamoDB.query({
                TableName: subscriptionTable,
                KeyConditions: {
                    Source: {
                        ComparisonOperator: 'EQ',
                        AttributeValueList: [
                            { S: source }
                        ]
                    }
                }
            }).promise());
            if(Array.isArray(targetsResponse.Items) && targetsResponse.Items.length > 0){
                let sqs = new SQS();
                let targets = targetsResponse.Items.map(item => `${item['Target'].S}@@@${sections[3]}`);
                await (sqs.sendMessage({
                    QueueUrl: queueUrl,
                    MessageBody: JSON.stringify(targets)
                }).promise());
            }
            return "OK";
        }
        case 'BuildSubscribe':{
            let subscriptionTable: string = process.env['BuildSubscriptionTable'];
            let subscriptionMapping: string = process.env['BuildMappingTable'];
            let dynamoDB = new DynamoDB();
            let response = await (dynamoDB.query({
                TableName: subscriptionMapping,
                KeyConditions: {
                    Source: {
                        ComparisonOperator: 'EQ',
                        AttributeValueList: [
                            { S: event.name }
                        ]
                    }
                }
            }).promise());
            if(response.Count > 0){
                // delete in the mappings
                let deleteRequests: DynamoDB.Types.BatchWriteItemInput = { RequestItems: {} };
                deleteRequests.RequestItems[subscriptionMapping] = response.Items.map(item => {
                    return                             {
                        DeleteRequest: {
                            Key: { Source: item['Source'], Target:  item['Target'] }
                        }
                    };
                });
                deleteRequests.RequestItems[subscriptionTable] = response.Items.map(item => {
                    return                          {
                        DeleteRequest: {
                            Key: { Source: item['Target'], Target:  item['Source'] }
                        }
                    };
                });
                await (dynamoDB.batchWriteItem(deleteRequests).promise());
            }
            {
                // write the relations
                let writeRequests: DynamoDB.Types.BatchWriteItemInput = { RequestItems: {} };
                writeRequests.RequestItems[subscriptionMapping] = event.subscriptions.map(item => {
                    return                             {
                        PutRequest: {
                            Item: { Source: { S: event.name }, Target:  { S: item } } 
                        }
                    };
                });
                writeRequests.RequestItems[subscriptionTable] = event.subscriptions.map(item => {
                    return                             {
                        PutRequest: {
                            Item: { Source: { S: item }, Target:  { S: event.name } }
                        }
                    };
                });
                await (dynamoDB.batchWriteItem(writeRequests).promise());
            }
        }
    }
    return "n/a";
};
