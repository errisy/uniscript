# uniscript

# Purpose
This tool is designed to provide a universal code template populator.
I also plan to make it a univeral script execution tool, which is the reason of its name.

# Getting Started
Install UniScript to enable the "us" commandlet
```bash
npm install -g uniscript
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
### Create TypeScript Project
```bash
us aws/ts/lambda [project-name]
```
### Create TypeScript Docker Project
```bash
us aws/ts/lambda-docker [project-name]
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