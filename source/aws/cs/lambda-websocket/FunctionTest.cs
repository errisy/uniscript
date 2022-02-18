using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Xunit;
using Amazon.Lambda.Core;
using Amazon.Lambda.TestUtilities;
using Amazon.Lambda.APIGatewayEvents;

using LambdaEntry;

namespace LambdaEntry.Tests
{
    public class FunctionTest
    {
        [Fact]
        public async void TestApiGatewayFunction()
        {

            // Invoke the lambda function and confirm the string was upper cased.
            var function = new Function();
            var context = new TestLambdaContext();
            var request = new APIGatewayProxyRequest();
            var response = await function.FunctionHandler(request, context);
            Assert.Equal(202, (response as APIGatewayProxyResponse).StatusCode);
        }
    }
}
