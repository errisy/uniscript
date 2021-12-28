import './use_env';
import {} from 'aws-sdk';

interface IEvent{
}

export async function handler (event: IEvent) {
    console.log('AWS Lambda Project "@{project}".');
    return {
        statusCode: 202,
        body: 'Accepted.'
    };
};

// Entry point fo the process
if (require.main == module) {
    (async () => await handler({}))();
}