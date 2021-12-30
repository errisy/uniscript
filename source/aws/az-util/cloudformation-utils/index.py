import traceback, base64, re, boto3
def handler(event, context):
    response = {
        "requestId": event["requestId"],
        "status": "success"
    }
    try:
        operation = event["params"]["Operation"]
        input = event["params"]["InputString"]
        no_param_string_funcs = ["Upper", "Lower", "Capitalize", "Title", "SwapCase"]
        if operation in no_param_string_funcs:
            response["fragment"] = getattr(input, operation.lower())()
        elif operation == "Strip":
            chars = None
            if "Chars" in event["params"]:
                chars = event["params"]["Chars"]
            response["fragment"] = input.strip(chars)
        elif operation == 'Base64':
            response["fragment"] = str(base64.b64encode(input.encode("utf-8")), "utf-8")
        elif operation == 'S3':
            rgxS3 = re.compile('[sS]3://([^/]{3,61})/(.*)')
            matches = rgxS3.match(input)
            s3 = boto3.resource('s3')
            obj = s3.Object(matches[1], matches[2])
            response["fragment"] = obj.get()['Body'].read().decode('utf-8')
        elif operation == 'S3Base64':
            rgxS3 = re.compile('[sS]3://([^/]{3,61})/(.*)')
            matches = rgxS3.match(input)
            s3 = boto3.resource('s3')
            obj = s3.Object(matches[1], matches[2])
            data = obj.get()['Body'].read().decode('utf-8')
            response["fragment"] = str(base64.b64encode(data.encode("utf-8")), "utf-8")
        elif operation == 'StackExport':
            cfn = boto3.client('cloudformation')
            rgxStack = re.compile('([\\w\\-_]+):([\\w\\-_]+)')
            matches = rgxStack.match(input)
            description = cfn.describe_stacks(StackName=matches[1])
            outputs = description['Stacks'][0]['Outputs']
            for output in outputs:
                if output['OutputKey'] == matches[2]:
                    response["fragment"] = str(output['OutputValue'])
                    break
        elif operation == 'Stack':
            cloudformation = boto3.client('cloudformation')
            resourceKey, stackName = input.split('@')
            result = cloudformation.describe_stack_resources(StackName=stackName)
            found = None
            for resource in result['StackResources']:
                if resource['LogicalResourceId'] == resourceKey:
                    found = resource['PhysicalResourceId']
            print('found ->', found)
            if not found:
                raise Exception('the resource can not be found in stack')
            response["fragment"] = found
        elif operation == 'StackCloudFrontUrl':
            cloudformation = boto3.client('cloudformation')
            resourceKey, stackName = input.split('@')
            result = cloudformation.describe_stack_resources(StackName=stackName)
            found = None
            for resource in result['StackResources']:
                if resource['LogicalResourceId'] == resourceKey:
                    found = resource['PhysicalResourceId']
            print('found physical id ->', found)
            if not found:
                raise Exception('the resource can not be found in stack')
            cloudfront = boto3.client('cloudfront')
            distributionResponse = cloudfront.get_distribution(Id=found)
            distribution = distributionResponse['Distribution']
            print(distribution)
            domain_name = distribution['DomainName']
            print('domain name:', domain_name)
            response["fragment"] = domain_name
        elif operation == 'LatestLayer':
            client = boto3.client('lambda')
            result = client.list_layer_versions(LayerName=input)
            if 'LayerVersions' in result and len(result['LayerVersions']) > 0:
                latestLayer = result['LayerVersions'][-1]
                response["fragment"] = latestLayer['LayerVersionArn']
            else:
                raise Exception('the lambda layer does not exist')
        elif operation == "Replace":
            old = event["params"]["Old"]
            new = event["params"]["New"]
            response["fragment"] = input.replace(old, new)
        elif operation == "MaxLength":
            length = int(event["params"]["Length"])
            if len(input) <= length:
                response["fragment"] = input
            elif "StripFrom" in event["params"]:
                if event["params"]["StripFrom"] == "Left":
                    response["fragment"] = input[len(input)-length:]
                elif event["params"]["StripFrom"] != "Right":
                    response["status"] = "failure"
            else:
                response["fragment"] = input[:length]
        elif operation == "EC2KeyPair":
            ec2 = boto3.client('ec2')
            name, uri = input.split('>>')
            print('name:', name, 'uri:', uri)
            try:
                keypairs = ec2.describe_key_pairs(KeyNames=[name])
                print('keypairs:', keypairs)
            except:
                created = ec2.create_key_pair(KeyName=name)
                s3 = boto3.client('s3')
                rgxS3 = re.compile('[sS]3://([^/]{3,61})/(.*)')
                matches = rgxS3.match(uri)
                print('save to:', matches[1], matches[2])
                s3.put_object(Bucket=matches[1], Key=matches[2], Body=created['KeyMaterial'])
            response["fragment"] = name
        else:
            response["status"] = "failure"
    except Exception as e:
        traceback.print_exc()
        response["status"] = "failure"
        response["errorMessage"] = str(e)
    return response