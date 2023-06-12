import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({region: "eu-west-3"})

async function invokeUpdateStatusLambda(){
    return await new Promise((resolve, reject) => {
        const params = {
            FunctionName: "periodicUpdatePrimeAccountsStatus",
            Payload: JSON.stringify({
            })
        }

        lambda.invoke(params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        })
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const handler = async (event) => {
    console.log(`Going to invoke updateStatus lambda ${process.env.numberOfInvocations} times every ${process.env.timeInbetweenInvocations} ms`)
    for(let i=0; i< process.env.numberOfInvocations; i++){
        invokeUpdateStatusLambda();
        console.log('Invoked updateStatus lambda')
        console.log(`Sleeping ${process.env.timeInbetweenInvocations} ms.`)
        await sleep(process.env.timeInbetweenInvocations)
    }
    return {
        statusCode: 200,
        body: JSON.stringify(`Scheduler ended succesfully`),
    };
};
