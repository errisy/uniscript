import * as fs from 'fs';


async function loadEnv(name: string = '') {
    try {
        let filename = `../.env/${name}.json`;
        if (fs.existsSync(filename)) {
            let envFileStats = await fs.promises.stat(filename);
            if (envFileStats.isFile()) {
                let text = await fs.promises.readFile(filename, { encoding: 'utf-8' });
                let environment_variables: {[key: string]: string} = JSON.parse(text);
                for (let key in environment_variables) {
                    let value = environment_variables[key];
                    process.env[key] = value;
                }
            }
        }
    } catch (ex) {
        console.log(ex);
    }
}

(async () => await loadEnv(''))();
