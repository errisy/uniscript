# use the '../.env' environment variables for local debugging
import use_env
from typing import Dict

def handler(event: Dict[str, any], context: Dict[str, any] = None):
    print('AWS Lambda Project "@{project}".')
    return {'status': 200}

if __name__ == '__main__':
    handler({})