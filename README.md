# uniscript

# Purpose
This tool is designed to provide a universal code template populator.
I also plan to make it a univeral script execution tool, which is the reason of its name.

# Getting Started
Install UniScript to enable the "us" commandlet
```bash
npm install -g uniscript
```
To verify the installation, try print the version with either of the following commands:
```bash
us --version
```
```bash
us -v
```
To update uniscript:
```bash
us t/update
```

# AWS + Azure DevOps
Use Amazon Web Service with Azure DevOps for CI/CD.
You need to install [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) with the [devops extension](https://docs.microsoft.com/en-us/azure/devops/cli/?view=azure-devops).
Initialize AWS + Azure DevOps:
```bash
us aws/az-dev
```
Modify the 'az-dev-env.yml'.
Then setup the project:
```bash
us aws/az-setup
```
## Azure DevOps Utilities
To get the tools working, a repo with the AWS utility functions for Azure DevOps is required.
0) Create The Azure DevOps project, create the "AWS Service Connection", where the connection name is the 12 digit AWS Account Id.
1) Initialize:
```bash
us aws/az-dev
```
2) Modify the 'az-dev-env.yml' with proper values, then run setup:
```bash
us aws/az-setup
```
3) Add the project source files and create corresponding Azure DevOps pipelines (This will work if your default brand is either "main" or "master"):
```bash
us aws/az-util
```
4) Details about [Azure Utilities](https://github.com/errisy/uniscript/tree/main/source/aws/az-util)
## Azure DevOps Operations
### Run Pipeline
Run the Azure DevOps pipeline for project:
```bash
us aws/az-run [project-name]
```
### Delete Pipeline
Delete the Azure DevOps pipeline for project:
```bash
us aws/az-rm [project-name]
```
## AWS Lambda
### Create Python Project
```bash
us aws/py/lambda [project-name]
```
### Create Python Docker Project
```bash
us aws/py/lambda-docker [project-name]
```
### Create Python Layer
```bash
us aws/py/layer [project-name]
```
### Create TypeScript Project
```bash
us aws/ts/lambda [project-name]
```
### Create TypeScript Docker Project
```bash
us aws/ts/lambda-docker [project-name]
```
### Create TypeScript Layer
```bash
us aws/ts/layer [project-name]
```
### Create C# Project
```bash
us aws/cs/lambda [project-name]
```
### Create C# Docker Project
```bash
us aws/cs/lambda-docker [project-name]
```
## AWS CloudFront
### Angular
This requires [@angular/cli](https://www.npmjs.com/package/@angular/cli)
```bash
us aws/cdn/angular [project-name]
```
### Update ApiGateway Websocket API and Cognito Login URL for Angular
This will update the environment.ts and environment.*.ts files.
```bash
us aws/cdn/angular-update [angular-project-name] [aws-profile-name] [users-project-name] [websocket-project-name] [environment-name]
```

## AWS Users
### Users
Create a users project
```bash
us aws/users
```

## AWS API
### JWT Layer
JWT Layer is required for Websocket, install it first before using the following API projects. JWT Layer is a nodejs layer.
```bash
us aws/api/jwt-layer
```
### Websocket
Create a Websocket project
```bash
us aws/api/websocket [project-name]
```
### Integrate Lambda to Websocket API
Add Lambda Integration to ApiGateway Websocket API.
```bash
us aws/api/websocket-lambda [websocket-project-name] [lambda-websocket-project-name] [namespace.service]
```
Where *namespace.service* is the service name from RPC
## RPC
### Create RPC Project
RPC project defines the data contracts and APIs between frontends and backends.
```bash
us aws/rpc [rpc-project-name]
```
In the *uni-rpc.yml* file, the **users** type can be emitted to the "Users" project to update the cloudformation.yml file.
This command also builds the RPC to targets.

### Build RPC Project
Build the TypeScript files to the targets defined in *uni-rpc.yml* file.
```bash
us aws/rpc-build [rpc-project-name]
```
This command builds the RPC to targets.
