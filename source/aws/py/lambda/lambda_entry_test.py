from absl.testing import absltest
from lambda_entry import handler

class LambdaEntryTest(absltest.TestCase):
    def test_handler(self):
        handler({})

if __name__ == '__main__':
    absltest.main()