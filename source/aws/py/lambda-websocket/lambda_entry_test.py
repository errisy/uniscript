# use the '../.env' environment variables for local debugging
import use_env
import json
from absl.testing import absltest
from lambda_entry import handler


class LambdaEntryTest(absltest.TestCase):
    def test_handler(self):
        body = {
            'routeKey': 'test',
            'message:': 'this is a test'
        }
        handler({
            'body': json.dumps(body)
        })


if __name__ == '__main__':
    absltest.main()