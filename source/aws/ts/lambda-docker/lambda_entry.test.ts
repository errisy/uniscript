import './use_env';
import { handler } from './lambda_entry';

test('test handler', async () => {
    handler({});
})