import { CloudFormation } from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';

interface IEnvironmentData {
    webSocketOptions: {[Service: string]: string};
    authUri: string;
    clientId: string;
}

declare let $: {[key:string]: any};

// Setup environment variables
process.env['AWS_REGION'] = $['awsProfileRegion'];
process.env['AWS_DEFAULT_REGION'] = $['awsProfileRegion'];
process.env['AWS_ACCESS_KEY_ID'] = $['awsAccessKeyId'];
process.env['AWS_SECRET_ACCESS_KEY'] = $['awsAccessSecretKey'];
process.env['AWS_ACCOUNT_ID'] = $['awsAccountId'];

// Name of the angular project
let angularProjectName: string = $['angularStack'];

// From az-env.${env}.yml
let application: string = $['applicationName'];
let region: string = $['awsRegion'];
let environmentTarget: string = $['environmentTarget']

// Name of the users project
let usersProjectName: string = $['usersStack'];
// Resource key of UserPool in the users cloudformation.yml
let userPoolName: string = $['userPool'];
// Resource key of UserPoolClient in the users cloudformation.yml
let userPoolClientName: string = $['userPoolClient'];
// Name of the websocket project
let apiGatewayProjectName: string = $['apiGatewayStack'];
// Resource key of ApiGateway in the websocket cloudformation.yml
let apiGatewayName: string = $['apiGateway'];

function beautify(data: any): string {
    let json = JSON.stringify(data, null, 2);
    return json.split('\n')
        .map((line) => {
            let colon = line.indexOf(':');
            if(colon > 0){
                let nameMatch = /\"([a-zA-Z$_]\w*)\"/ig.exec(line.substring(0, colon));
                let name = nameMatch[1];
                console.log('name:', name);
                return `  ${name}` + line.substr(colon);
            }
            else{
                return line;
            }
        }).join('\n');
}

async function updateAngularEnvironments(angularProjectName: string,
    application: string, region: string, environmentTarget: string,
    usersProjectName: string, userPoolName: string, userPoolClientName: string,
    apiGatewayProjectName: string, apiGatewayName: string) {

    let cfn = new CloudFormation({region: region});

    console.log('connect to cloudforamtion');

    let usersResources = await (cfn.describeStackResources({
        StackName: `${application}--${usersProjectName}--${region}--${environmentTarget}`
    }).promise());

    let userPoolPhysicalId: string = null;
    let userPoolClientPhysicalId: string = null;
    for(let resource of usersResources.StackResources){
        if(resource.LogicalResourceId == userPoolName){
            userPoolPhysicalId = resource.PhysicalResourceId;
        }
        if(resource.LogicalResourceId == userPoolClientName){
            userPoolClientPhysicalId = resource.PhysicalResourceId;
        }
    }

    console.log(`Resource: ${userPoolName} ==> ${userPoolPhysicalId}`);
    console.log(`Resource: ${userPoolClientName} ==> ${userPoolClientPhysicalId}`);

    let apiGatewayResources = await (cfn.describeStackResources({
        StackName: `${application}--${apiGatewayProjectName}--${region}--${environmentTarget}`
    }).promise());

    let apiGatewayPhysicalId: string = null;
    for(let resource of apiGatewayResources.StackResources){
        if(resource.LogicalResourceId == apiGatewayName){
            apiGatewayPhysicalId = resource.PhysicalResourceId;
        }
    }
    console.log(`Resource: ${apiGatewayName} ==> ${apiGatewayPhysicalId}`);

    let environmentsPath: string = path.join(angularProjectName, 'src', 'environments');
    let environments = fs.readdirSync(environmentsPath);
    for(let environment of environments){
        let lowerName = environment.toLowerCase();
        if(lowerName.startsWith('environment.') && lowerName.endsWith('.ts')){
            let fullpath = path.join(environmentsPath, environment);
            let script = fs.readFileSync(fullpath, {encoding: 'utf-8'});
            let start = script.indexOf('{'), end = script.lastIndexOf('}');
            let dict = script.substring(start, end + 1);
            let data: IEnvironmentData = eval(`(${dict})`);
            // console.log('data:', data);
            data.webSocketOptions = {
                __default: `wss://${apiGatewayPhysicalId}.execute-api.${region}.amazonaws.com/prod`
            };
            data.authUri = `https://${application}-${usersProjectName}-login.auth.${region}.amazoncognito.com`
            data.clientId = userPoolClientPhysicalId;
            // console.log('beautify:', beautify(data));
            fs.writeFileSync(fullpath, `export const environment = ${beautify(data)};`);
        }
    }
}


console.log('application:', application);
console.log('region:', region);
console.log('environmentTarget:', environmentTarget);
console.log('usersProjectName:', usersProjectName);
console.log('userPoolName:', userPoolName);
console.log('userPoolClientName:', userPoolClientName);
console.log('apiGatewayProjectName:', apiGatewayProjectName);
console.log('apiGatewayName:', apiGatewayName);

console.log('AWS_REGION:', process.env['AWS_REGION']);
console.log('AWS_DEFAULT_REGION:', process.env['AWS_DEFAULT_REGION']);
console.log('AWS_ACCESS_KEY_ID:', process.env['AWS_ACCESS_KEY_ID']);
console.log('AWS_SECRET_ACCESS_KEY:', process.env['AWS_SECRET_ACCESS_KEY']);
console.log('AWS_ACCOUNT_ID:', process.env['AWS_ACCOUNT_ID']);

try {
    (async () => await updateAngularEnvironments(
        angularProjectName, application, region, environmentTarget,
        usersProjectName, userPoolName, userPoolClientName,
        apiGatewayProjectName, apiGatewayName))();
} catch (ex) {
    console.error('Error:', ex);
}
