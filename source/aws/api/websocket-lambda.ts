import * as fs from 'fs';
import * as path from 'path';

declare let $: {[key:string]: any};

let websocketProject: string = $['websocketProject'];
let lambdaProject: string = $['lambdaProject'];
let service: string = $['service'];

function ReadFileSync(filename: string, encoding?: BufferEncoding): string {
    if (typeof encoding == 'undefined' || encoding.length == 0) {
        encoding = 'utf8';
    }
    return fs.readFileSync(filename, { encoding: encoding });
}

function WriteFileSync(filename: string, data: string, encoding?: BufferEncoding) {
    if (typeof encoding == 'undefined' || encoding.length == 0) {
        encoding = 'utf8';
    }
    fs.writeFileSync(filename, data, encoding);
}

const SectionBegin = '# No Manual Change { websocket-lambda /*';
const SectionEnd = '# */ websocket-lambda } No Manual Change';

function EmitUserGroupsAndUsers () {
    let lines: string[] = [];
    let websocketProjectTitle = websocketProject.replaceAll('-', '11');
    let lambdaProjectTitle = lambdaProject.replaceAll('-', '11');
    lines.push(`  # Integrate ${lambdaProject} as API for ${websocketProject}`);
    lines.push(`  ${websocketProjectTitle}010${lambdaProjectTitle}010Integration:`);
    lines.push(`    Type: AWS::ApiGatewayV2::Integration`);
    lines.push(`    Properties:`);
    lines.push(`      ApiId: !Ref LambdaWebSocket`);
    lines.push(`      Description: '${lambdaProject} as API for ${websocketProject}'`);
    lines.push(`      IntegrationType: AWS_PROXY`);
    lines.push(`      IntegrationUri: !Sub arn:aws:apigateway:\${AWSRegion}:lambda:path/2015-03-31/functions/arn:aws:lambda:\${AWSRegion}:\${AWSAccountId}:function:\${Application}--${lambdaProject}--\${EnvironmentTarget}/invocations`);
    lines.push(`  ${websocketProjectTitle}010${lambdaProjectTitle}010Route:`);
    lines.push(`    Type: AWS::ApiGatewayV2::Route`);
    lines.push(`    Properties:`);
    lines.push(`      ApiId: !Ref LambdaWebSocket`);
    lines.push(`      RouteKey: ${service}`);
    lines.push(`      AuthorizationType: NONE`);
    lines.push(`      OperationName: '${websocketProject} ${lambdaProject} Route'`);
    lines.push(`      Target: !Sub integrations/\${${websocketProjectTitle}010${lambdaProjectTitle}010Integration}`);
    return lines.join('\n');
}

function UpdateCloudFormation(websocket: string, lambda: string) {
    let filename = path.join(websocket, 'cloudformation.yml');
    let yaml = ReadFileSync(filename);
    let indexBegin = yaml.indexOf(SectionBegin);
    let indexEnd = yaml.lastIndexOf(SectionEnd);
    let before = yaml.substring(0, indexBegin);
    let after = yaml.substring(indexEnd);
    let emitted = EmitUserGroupsAndUsers();
    let updated = [before, emitted, SectionBegin, after].join('\n');
    WriteFileSync(filename, updated);
}

function Main() {
    try{
        UpdateCloudFormation(websocketProject, lambdaProject);
    } catch (ex) {
        console.log('Error:', ex);
    }
}

// Call the Main function to run the logic
Main();