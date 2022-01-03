import { CloudFormation, EventBridge } from 'aws-sdk';

interface IEvent {
    action: 'Create' | 'Delete' | 'Check'  | 'Output' | 'Get'; // | 'Validate'
    url?: string;
    name: string;
    role?: string;
    capabilities?: string[];
    parameters?: {[key: string]: any};
    state?: 'CREATE_COMPLETE' | 'CREATE_IN_PROGRESS' | 'CREATE_FAILED' | 'DELETE_COMPLETE' | 'DELETE_FAILED' | 'DELETE_IN_PROGRESS' | 'REVIEW_IN_PROGRESS';
    output?: {[key: string]: any};
    wait?: number;
    values?: string[];
    /** the id for Get operation */
    id?: string;
}

declare let exports : {
    handler: (event: IEvent) => Promise<IEvent>
};

export async function handler (event: IEvent) {
    if(typeof event.wait != 'number' || event.wait <= 0) event.wait = 5;
    let cfn = new CloudFormation();
    switch(event.action){
        case 'Create': {
            let createStackInput : CloudFormation.CreateStackInput = <any>{};
            createStackInput.TemplateURL = event.url; 
            createStackInput.StackName = event.name; 
            createStackInput.RoleARN = event.role;
            createStackInput.Capabilities = event.capabilities;
            createStackInput.Parameters = [];
            for(let key in event.parameters){
                let parameter: CloudFormation.Parameter = <any>{};
                parameter.ParameterKey = key;
                let value = event.parameters[key];
                if(typeof value != 'string') value = `${value}`;
                parameter.ParameterValue = value;
                createStackInput.Parameters.push(parameter);
            }
            let output = await (cfn.createStack(createStackInput).promise());
            event.state = 'CREATE_IN_PROGRESS';
            event.action = 'Check';
            return event;
        }
        case 'Delete': {
            let deleteStackInput: CloudFormation.DeleteStackInput = <any>{};
            deleteStackInput.RoleARN = event.role;
            deleteStackInput.StackName = event.name;
            await (cfn.deleteStack(deleteStackInput).promise());
            event.state = 'DELETE_IN_PROGRESS';
            event.action = 'Check';
            return event;
        }
        case 'Check': {
            let describeStacksInput: CloudFormation.DescribeStacksInput = <any>{};
            describeStacksInput.StackName = event.name;
            try{
                let output =  await (cfn.describeStacks(describeStacksInput).promise());
                event.state = <any> output.Stacks[0].StackStatus;
                event.values = [event.state];
                return event;
            }
            catch(ex){
                console.log(ex);
                event.state = 'DELETE_COMPLETE';
                event.values = [event.state];
                return event;
            }
        }
        // case 'Validate': {
        //     let validateTemplateInput: CloudFormation.ValidateTemplateInput = <any>{};
        //     validateTemplateInput.TemplateURL = event.url;
        //     let output = await(cfn.validateTemplate(validateTemplateInput).promise());
        //     return output;
        // }
        case 'Output': {
            let describeStacksInput: CloudFormation.DescribeStacksInput = <any>{};
            describeStacksInput.StackName = event.name;
            try{
                let output =  await (cfn.describeStacks(describeStacksInput).promise());
                let result: {[key: string]: string} = {};
                for(let item of output.Stacks[0].Outputs){
                    result[item.OutputKey] = item.OutputValue;
                }
                event.output = result;
                return event;
            }
            catch(ex){
                console.log(ex);
                event.output = {};
                return event;
            }
        }
        case 'Get': {
            let response = await (cfn.describeStackResources({
                StackName: event.name
            }).promise());
            for(let resource of response.StackResources){
                if(resource.LogicalResourceId == event.id) {
                    return resource.PhysicalResourceId;
                }
            }
            throw `"${event.id}" in Stack "${event.name}" not Found!`;
        }
    }
    throw `Unkown Action Type: ${event.action}`;
}