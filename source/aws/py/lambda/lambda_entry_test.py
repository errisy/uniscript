# use the '../.env' environment variables for local debugging
import use_env
from absl.testing import absltest
from lambda_entry import handler

class LambdaEntryTest(absltest.TestCase):
    def test_handler(self):
        handler({})

if __name__ == '__main__':
    absltest.main()