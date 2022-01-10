import { SourceFileResovler } from './resolvers';
import { Target } from './rpc-configuration';
import { CopyDirectory, MakeDirectories, ReadFile, ReadFileSync, Remove, ResolvePath, WriteFile } from './os-utilities';
import * as path from 'path';
import { GroupManagement, UserManagement } from './group-management';

export class Transpiler {
    constructor (private resolver: SourceFileResovler) {
    }
    public emit(target: Target) {
        if (typeof target.users == 'string' && target.type == 'cognito') {
            let rootDirectory = ResolvePath(target.users);
            if (this.resolver.Groups && this.resolver.Groups.size > 0) {
                let groups = new CodeGeneration.CloudFormationUpdater(this.resolver.Groups, this.resolver.Users);
                groups.emitFile(rootDirectory);
            }
        }
    }
}

module CodeGeneration {
    const SectionBegin = '# No Manual Change { rpc-users /*';
    const SectionEnd = '# */ rpc-users } No Manual Change';
    export class CloudFormationUpdater {
        constructor(private groups: Map<string, GroupManagement>, private users: Map<string, UserManagement>) { }
        emitFile(rootDirectory: string) {
            let filename = path.join(rootDirectory, 'cloudformation.yml');
            let yaml = ReadFileSync(filename);
            let indexBegin = yaml.indexOf(SectionBegin);
            let indexEnd = yaml.lastIndexOf(SectionEnd);
            let before = yaml.substring(0, indexBegin + SectionBegin.length);
            let after = yaml.substring(indexEnd);
            let emitted = this.emitUserGroupsAndUsers();
            let updated = [before, emitted, after].join('\n');
            console.log('Write Code to:', filename);
            WriteFile(filename, updated, 'utf-8');
        }
        emitUserGroupsAndUsers() {
            let lines: string[] = [];
            for (let groupName of this.groups.keys()) {
                let group = this.groups.get(groupName);
                for (let member of group.Members) {
                    lines.push(`  # User Group ${groupName}.${member}`);
                    lines.push(`  UserPoolGroup${groupName}010${member}:`);
                    lines.push(`    Type: AWS::Cognito::UserPoolGroup`);
                    lines.push(`    Properties: `);
                    lines.push(`      GroupName: ${groupName}.${member}`);
                    lines.push(`      Description: "The ${groupName}.${member} Group"`);
                    lines.push(`      UserPoolId: !Ref UserPool`);
                    lines.push(``);
                }
            }
            for (let userName of this.users.keys()) {
                let user = this.users.get(userName);
                lines.push(`  # User ${userName}`);
                lines.push(`  UserPoolUser${userName}:`);
                lines.push(`    Type: AWS::Cognito::UserPoolUser`);
                lines.push(`    Properties:`);
                lines.push(`      UserPoolId: !Ref UserPool`);
                lines.push(`      Username: ${userName}`);
                lines.push(`      DesiredDeliveryMediums:`);
                lines.push(`        - EMAIL`);
                lines.push(`      UserAttributes:`);
                lines.push(`        - Name: 'name'`);
                lines.push(`          Value: ${userName}`);
                lines.push(`        - Name: 'email'`);
                lines.push(`          Value: '${user.Email}'`);
                lines.push(`        - Name: phone_number`);
                lines.push(`          Value: '${user.PhoneNumber}'`);
                lines.push(`        - Name: email_verified`);
                lines.push(`          Value: true`);
                lines.push(`          Value: true`);
                lines.push(`          Value: true`);
                lines.push(``);
                for (let groupName of user.Groups.keys()) {
                    let group = user.Groups.get(groupName);
                    for (let member of group) {
                        lines.push(`  # Attach User ${userName} to Group ${groupName}.${member}`);
                        lines.push(`  UserPoolUserAttach010${userName}0110${groupName}010${member}:`);
                        lines.push(`    Type: AWS::Cognito::UserPoolUserToGroupAttachment`);
                        lines.push(`    DependsOn:`);
                        lines.push(`      - UserPoolUser${userName}`);
                        lines.push(`      - UserPoolGroup${groupName}010${member}`);
                        lines.push(`    Properties:`);
                        lines.push(`      GroupName: ${groupName}.${member}`);
                        lines.push(`      Username: ${userName}`);
                        lines.push(`      UserPoolId: !Ref UserPool`);
                        lines.push(``);
                    }
                }
            }
            return lines.join('\n');
        }
    }
}