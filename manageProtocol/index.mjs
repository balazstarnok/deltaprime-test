import { createRequire } from 'module';
import {formatUnits} from "@ethersproject/units";
const require = createRequire(import.meta.url);
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const fs = require('fs');
const mysql = require('mysql')
const {ethers} = require('ethers');
const avalancheRPCurl = "https://avax.nirvanalabs.xyz/avalanche_mainnet_elastic_01/ext/bc/C/rpc?apikey=d63168833894bb0dd6677607e358e11c7547";
const knownPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const POOL_ABI = require('./abis/IPool.json');
const IERC20_ABI = require('./abis/IERC20.json');
const USDC_POOL_TUP = '0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b';
const WAVX_POOL_TUP = '0xD26E504fc642B96751fD55D3E68AF295806542f5';
const BTC_POOL_TUP = '0x475589b0Ed87591A893Df42EC6076d2499bB63d0';
const ETH_POOL_TUP = '0xD7fEB276ba254cD9b34804A986CE9a8C3E359148';
const TOKEN_ADDRESSES = require('token_addresses.json')

const REDSTONE_CACHE_URLS = [
    "https://oracle-gateway-1.a.redstone.finance",
    "https://oracle-gateway-2.a.redstone.finance"
]

const PRIME_ACCOUNT_ABI = [
    {
        "inputs": [],
        "name": "getTotalValue",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "vectorUSDC1Balance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getThresholdWeightedValue",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getDebt",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getFullLoanStatus",
        "outputs": [
            {
                "internalType": "uint256[5]",
                "name": "",
                "type": "uint256[5]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getHealthRatio",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalValue",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "isSolvent",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
]

function query (con, sql) {
    return new Promise((resolve, reject) => {
        con.query(sql, (err, result) => {
            if (err) reject(err);
            else     resolve(result);
        });
    });
}

function getDbConnection(){
    let writer_instance_endpoint = "prime-accounts-liquidation-db-instance-1.cnncajcyupga.eu-west-3.rds.amazonaws.com"
    const connection = mysql.createConnection({
        host     : writer_instance_endpoint,
        user     : 'admin',
        password : 'Avaloan2137!',
        database  : 'primeaccountsliquidationdb'
    });
    console.log('Db connection opened');
    return connection
}

function closeDbConnection(connection){
    connection.end()
    console.log('Db connection closed');
}

async function createPrimeAccountsDBTable(con){
    const q = fs.readFileSync('sqlQueries/createPrimeAccountsTable.sql').toString();
    await query(con, q);
}

async function deletePrimeAccountsDBTable(con){
    const q = fs.readFileSync('sqlQueries/deletePrimeAccountsTable.sql').toString();
    await query(con, q);
}

async function createPrivateKeysDBTable(con){
    const q = fs.readFileSync('sqlQueries/createPrivateKeysTable.sql').toString();
    await query(con, q);
}

async function deletePrivateKeysDBTable(con){
    const q = fs.readFileSync('sqlQueries/deletePrivateKeysTable.sql').toString();
    await query(con, q);
}

async function createStringToNumberTableDBTable(con){
    const q = fs.readFileSync('sqlQueries/createStringToNumberTable.sql').toString();
    await query(con, q);
}

async function deleteStringToNumberTableDBTable(con){
    const q = fs.readFileSync('sqlQueries/deleteStringToNumberTable.sql').toString();
    await query(con, q);
}

async function listAllTables(con){
    const q = fs.readFileSync('sqlQueries/listTables.sql').toString();
    let result = await query(con, q);
    result = result.map((el) => {return el['Tables_in_primeaccountsliquidationdb']})
    console.log(`DB tables: ${result}`);
    return result;
}

function logPADetails(address, owner, totalValue, debt, hr, solvent, insolventSince, liquidationInProgress, updatedAt, createdAt){
    console.log(`PA[${address}] HR[${hr/1e18}] Solvent[${Boolean(solvent)};${insolventSince}] LiqInProgress[${Boolean(liquidationInProgress)}] TV[$${totalValue/1e18}] D[$${debt/1e18}] updatedAt[${updatedAt.toISOString()}] createdAt[${createdAt.toISOString()}]`)
}

async function getInsolventAccounts(con){
    let q = 'SELECT * FROM PrimeAccounts WHERE isSolvent = false'
    let result = await query(con, q)
    console.log(`Found ${result.length} insolvent accounts`)
    for(const pa of result){
        logPADetails(pa.address, pa.owner, pa.totalValueUSD, pa.debtUSD, pa.healthRatio, pa.isSolvent, pa.insolventSince, pa.liquidationInProgress, pa.updatedAt, pa.createdAt);
    }
}

async function checkPTPUSDCTotalBorrowersExposure(con){
    let q = `SELECT * FROM PrimeAccounts`;
    let result = await query(con, q);
    console.log(`Going to scan ${result.length} PAs in search for VF PTP USDC vault exposure`)
    let usdcExposureSum = 0;
    let index = 0;
    for(const pa of result){
        let wrappedLoan = await getWrappedPrimeAccount(pa.address);
        const platypusUsdcBalance = await wrappedLoan.vectorUSDC1Balance();
        if(platypusUsdcBalance > 0){
            usdcExposureSum += Number(platypusUsdcBalance);
        }
    }
    console.log(`Total borrowers exposure: ${Number(usdcExposureSum) / 1e6}`)
}

async function checkEveryProtocolExposure(con){
    let q = `SELECT * FROM PrimeAccounts`;
    let result = await query(con, q);
    console.log(`Going to scan ${result.length} PAs and analyze exposure`)

    const provider = new ethers.providers.JsonRpcProvider(avalancheRPCurl);
    const wallet = new ethers.Wallet(knownPrivateKey, provider);

    let protocolsExposure = {}
    let assetsCounter = 0;
    for(const [asset, address] of Object.entries(TOKEN_ADDRESSES)){
        if(address !== process.env.exposureCheckAddress){
            continue;
        }
        assetsCounter += 1;
        let erc20Contract = await new ethers.Contract(address, IERC20_ABI, wallet)
        let decimals = await erc20Contract.decimals();
        let balance = 0;

        console.log(`Analyzing ${asset}(${address}) exposure [${assetsCounter}/${Object.keys(TOKEN_ADDRESSES).length}]`)
        let batchSize = 300;
        let balancePromises = []
        let balanceResults = [];
        for(let i=0; i< Math.ceil(result.length/batchSize); i++) {
            console.log(`Requesting batch results for batch ${i}/${Math.ceil(result.length/batchSize)} (batch size: ${batchSize})`)
            for(const pa of result.slice(i*batchSize, (i+1)*batchSize)){
                balancePromises.push(erc20Contract.depositTracking(pa.address));
                // balancePromises.push(erc20Contract.balanceOf(pa.address));
            }
            balanceResults = balanceResults.concat(await Promise.all(balancePromises));
            balancePromises = [];
        }

        console.log(`XXX result len: ${result.length}`)
        console.log(`XXX balanceResults len: ${balanceResults.length}`)
        let paCounter = 0;
        for(const balance of balanceResults){
            protocolsExposure[asset] === undefined ? protocolsExposure[asset] = balance : protocolsExposure[asset] = protocolsExposure[asset].add(balance);
            // console.log(`[${result[paCounter].address}] balance of ${asset}(${address}) is: ${balance} (${formatUnits(balance, decimals)})`)
            // console.log(`Current sum of ${asset}(${address}) exposure is ${protocolsExposure[asset]} (${formatUnits(protocolsExposure[asset], decimals)})`)
            paCounter += 1;
        }
    }

    for(const [asset, address] of Object.entries(TOKEN_ADDRESSES)){
        if(address !== process.env.exposureCheckAddress){
            continue;
        }
        let erc20Contract = await new ethers.Contract(address, IERC20_ABI, wallet)
        let decimals = await erc20Contract.decimals();

        console.log(`Final sum of ${asset}(${address}) exposure is ${protocolsExposure[asset]} (${formatUnits(protocolsExposure[asset], decimals)})`)
    }
}


async function checkUSDTUSDTeSHExposure(con){
    let q = `SELECT * FROM PrimeAccounts`;
    let result = await query(con, q);

    const provider = new ethers.providers.JsonRpcProvider(avalancheRPCurl);
    const wallet = new ethers.Wallet(knownPrivateKey, provider);

    let sh_usdt_usdte_exposure = 0;

    console.log(`Going to scan ${result.length} PAs in search for SH USDT-USDT.e vault exposure`)

    let index = 0;
    for(const pa of result){
        let shUsdtUsdteVaultContract = await new ethers.Contract("0x9f44e67ba256c18411bb041375e572e3dd11fa72", IERC20_ABI, wallet)
        const shUsdtUsdteBalance = await shUsdtUsdteVaultContract.balanceOf(pa.address);
        if(shUsdtUsdteBalance > 0){
            sh_usdt_usdte_exposure += Number(shUsdtUsdteBalance);
        }
    }
    console.log(`Total SH USDT-USDT.e exposure: ${Number(sh_usdt_usdte_exposure)} (${sh_usdt_usdte_exposure / 1e18})`)
}

async function checkPTPHackStatistics(con){
    let q = `SELECT * FROM PrimeAccounts WHERE healthRatio <= "${ethers.utils.parseEther("1.0")}"`;
    let result = await query(con, q)
    console.log(`Found ${result.length} insolvent accounts`)
    for(const pa of result){
        logPADetails(pa.address, pa.owner, pa.totalValueUSD, pa.debtUSD, pa.healthRatio, pa.isSolvent, pa.insolventSince, pa.liquidationInProgress, pa.updatedAt, pa.createdAt);
    }

    let avaxBadDebtSum = 0;
    let usdcDebtSum = 0;
    let totalDebtSum = 0;
    let totalValueWithoutPlatypus = 0;
    const provider = new ethers.providers.JsonRpcProvider(avalancheRPCurl);
    const wallet = new ethers.Wallet(knownPrivateKey, provider);
    let wavaxPoolContract = new ethers.Contract(WAVX_POOL_TUP, POOL_ABI, wallet)
    let usdcPoolContract = new ethers.Contract(USDC_POOL_TUP, POOL_ABI, wallet)
    for(const pa of result){
        let wrappedLoan = await getWrappedPrimeAccount(pa.address);
        const platypusUsdcBalance = await wrappedLoan.vectorUSDC1Balance();

        if(platypusUsdcBalance > 0){
            let avaxDebt = Number(await wavaxPoolContract.getBorrowed(wrappedLoan.address));
            let usdcDebt = Number(await usdcPoolContract.getBorrowed(wrappedLoan.address));
            let debt = Number(await wrappedLoan.getDebt());
            let totalValue = (Number(await wrappedLoan.getTotalValue())/1e18) - (Number(platypusUsdcBalance) / 1e6);

            usdcDebtSum += usdcDebt;
            totalDebtSum += debt;
            avaxBadDebtSum += avaxDebt;
            totalValueWithoutPlatypus += totalValue;

            console.log(`Account ${pa.address} has ${avaxDebt} AVAX debt`);
            console.log(`Account ${pa.address} has ${usdcDebt} USDC debt`);
            console.log(`Account ${pa.address} has ${debt} total debt`);
            console.log(`Tmp AVAX "bad debt": ${avaxBadDebtSum / 1e18}`);
        }

    }
    console.log(`Total AVAX "bad debt": ${avaxBadDebtSum / 1e18}`);
    console.log(`Total USDC debt": ${usdcDebtSum / 1e6}`);
    console.log(`Total debt": ${totalDebtSum / 1e18}`);
    console.log(`Actual bad debt of insolvent PTP holders: ${(totalDebtSum / 1e18) - totalValueWithoutPlatypus}`);
}

async function getWrappedPrimeAccount(primeAccountAddress, dataPackages=null){
    let wrappedLoan;
    const provider = new ethers.providers.JsonRpcProvider(avalancheRPCurl);
    const wallet = new ethers.Wallet(knownPrivateKey, provider);
    const primeAccount = new ethers.Contract(primeAccountAddress, PRIME_ACCOUNT_ABI, wallet);

    if(dataPackages !== null){
        wrappedLoan = WrapperBuilder.wrap(primeAccount).usingDataPackages(dataPackages);
    } else {
        wrappedLoan = WrapperBuilder.wrap(primeAccount).usingDataService(
            {
                dataServiceId: "redstone-avalanche-prod",
                uniqueSignersCount: 3,
                disablePayloadsDryRun: true
            },
            REDSTONE_CACHE_URLS
        );
    }

    return wrappedLoan;
}

async function getPrimeAccountsCount(con){
    const q = fs.readFileSync('sqlQueries/countPrimeAccounts.sql').toString();
    const result = (await query(con, q))[0];
    console.log(`Count of PrimeAccounts: ${result['COUNT(*)']}`);
    return result['COUNT(*)'];
}

async function getPrivateKeysCount(con){
    const q = fs.readFileSync('sqlQueries/countPrivateKeys.sql').toString();
    const result = (await query(con, q))[0];
    console.log(`Count of PrivateKeys: ${result['COUNT(*)']}`);
    return result['COUNT(*)'];
}

async function getStringToNumberTableCount(con){
    const q = fs.readFileSync('sqlQueries/countStringToNumberTable.sql').toString();
    const result = (await query(con, q))[0];
    console.log(`Count of StringToNumberTable: ${result['COUNT(*)']}`);
    return result['COUNT(*)'];
}

async function initializeLastUsedBlock(con){
    const q = `INSERT INTO StringToNumberTable (stringKey, numberValue) VALUES  ("lastUsedBlock", 23431194);`
    await query(con, q);
    console.log(`Initialized lastUsedBlock with block number 23431194`);
}

async function initializeLastUsedFailedTxsBlock(con){
    const q = `INSERT INTO StringToNumberTable (stringKey, numberValue) VALUES  ("lastUsedFailedTxsBlock", 23431194);`
    await query(con, q);
    console.log(`Initialized lastUsedFailedTxsBlock with block number 23431194`);
}

async function getPACreationEventsLastUsedBlockFromDb(con){
    const q = `SELECT numberValue FROM StringToNumberTable WHERE stringKey="lastUsedBlock"`
    return (await query(con, q))[0];
}

async function getLastUsedFailedTxsBlockFromDb(con){
    const q = `SELECT numberValue FROM StringToNumberTable WHERE stringKey="lastUsedFailedTxsBlock"`
    return (await query(con, q))[0];
}

async function checkStatusOfPrimeAccount(con, paAddress){
    const q = `SELECT * FROM PrimeAccounts WHERE address="${paAddress}"`;
    const result = (await query(con, q))[0];
    logPADetails(result.address, result.owner, result.totalValueUSD, result.debtUSD, result.healthRatio, result.isSolvent, result.insolventSince, result.liquidationInProgress, result.updatedAt, result.createdAt);
}


async function addPrivateKey(con, keyAddress, keyPrivate){
    const provider = new ethers.providers.JsonRpcProvider(avalancheRPCurl);
    const balance = await provider.getBalance(keyAddress);
    const q = `INSERT INTO PrivateKeys (address, privateKey, isAvailable, avaxLeft) VALUES ("${keyAddress}", "${keyPrivate}", TRUE, "${balance}")`
    await query(con, q);
    console.log(`Added 1 key (${keyAddress})`);
}

async function getLoansBelowHRThreshold(con, hrThresholdInclusive="1.0"){
    const q = `SELECT * FROM PrimeAccounts WHERE healthRatio <= "${ethers.utils.parseEther(hrThresholdInclusive)}" ORDER BY healthRatio ASC;`
    const result = await query(con, q);
    console.log(`Found ${result.length} Prime Accounts matching the "HR <= ${hrThresholdInclusive}" criteria`)
    for(const pa of result){
        logPADetails(pa.address, pa.owner, pa.totalValueUSD, pa.debtUSD, pa.healthRatio, pa.isSolvent, pa.insolventSince, pa.liquidationInProgress, pa.updatedAt, pa.createdAt);
    }
}

async function checkPrivateKeysStatus(con){
    const q = `SELECT address, isAvailable, avaxLeft FROM PrivateKeys ORDER BY avaxLeft DESC`;
    const result = await query(con, q);
    console.log(`Found ${result.length} liquidation private keys`)
    for(const key of result){
        console.log(`Liquidation private key: ${key.address}, isAvailable: ${Boolean(key.isAvailable)} (AVAX: ${key.avaxLeft / 1e18})`);
    }
}

async function getPoolSurplus(poolAddress){
    const provider = new ethers.providers.JsonRpcProvider(avalancheRPCurl);
    const wallet = new ethers.Wallet(knownPrivateKey, provider);

    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, wallet);
    const tokenContract = new ethers.Contract(await poolContract.tokenAddress(), IERC20_ABI, wallet);

    let [decimals, tokenName] = await Promise.all([tokenContract.decimals(), tokenContract.name()]);

    let [balance, totalBorrowed, totalSupply] = await Promise.all([
        tokenContract.balanceOf(poolAddress),
        poolContract.totalBorrowed(),
        poolContract.totalSupply()
    ]);

    console.log(`Balance: ${balance} | totalBorrowed: ${totalBorrowed} | totalSupply: ${totalSupply}`)

    balance = Number(formatUnits(balance, decimals));
    totalBorrowed = Number(formatUnits(totalBorrowed, decimals));
    totalSupply = Number(formatUnits(totalSupply, decimals));

    console.log(`Balance: ${balance} | totalBorrowed: ${totalBorrowed} | totalSupply: ${totalSupply}`)

    const surplus = balance + totalBorrowed - totalSupply;

    return {tokenName: tokenName, surplus: surplus}
}

async function checkSpreadSurplus(){
    for(const pool of [USDC_POOL_TUP, WAVX_POOL_TUP, BTC_POOL_TUP, ETH_POOL_TUP]){
        let poolsDetails = await getPoolSurplus(pool);
        console.log(`[Pool: ${poolsDetails.tokenName}] Surplus: ${poolsDetails.surplus} (in ${poolsDetails.tokenName})`);
    }
}

async function setKeysToAvailable(con){
    const q = 'UPDATE PrivateKeys SET isAvailable = true';
    await query(con, q);
    console.log(`Set all liqudation private keys isAvailable to TRUE`);
}

async function setKeysToUnAvailable(con){
    const q = 'UPDATE PrivateKeys SET isAvailable = false';
    await query(con, q);
    console.log(`Set all liqudation private keys isAvailable to FALSE`);
}

async function checkSQLQuery(con){
    const q = 'SELECT * FROM PrimeAccounts ORDER BY updatedAt ASC';
    let result = await query(con, q);
    let firstTenPas = result.slice(0,10);
    let lastPa = result[result.length - 1];
    let counter =  0;
    for(const pa of firstTenPas){
        counter +=1;
        console.log(`PA  ${counter}/${firstTenPas.length}: ${pa.address} -> ${pa.updatedAt.toISOString()}`)
    }

    console.log(`lastPa: ${lastPa.address} -> ${lastPa.updatedAt.toISOString()}`)
}

async function resetLastUsedBlock(con){
    let blockNumber = 23431194;
    const q = `UPDATE StringToNumberTable SET numberValue = ${blockNumber} WHERE stringKey="lastUsedBlock"`;
    await query(con, q);
    console.log(`Updated last used block to: ${blockNumber}`)
}

function getPriceWithLatestTimestamp(prices, symbol){
    if(symbol in prices){
        let symbolPriceObject = prices[symbol];
        let currentNewestTimestamp = 0;
        let currentNewestTimestampIndex = 0;
        for(let i=0; i<symbolPriceObject.length; i++){
            if(symbolPriceObject[0].timestampMilliseconds > currentNewestTimestamp){
                currentNewestTimestamp = symbolPriceObject[0].timestampMilliseconds;
                currentNewestTimestampIndex = i;
            }
        }
        return symbolPriceObject[currentNewestTimestampIndex].dataPoints[0].value;
    } else {
        throw new Error(`Symbol ${symbol} not found in the prices object`);
    }
}

async function getRedstonePrices(tokenSymbols) {
    const redstonePrices = await (await fetch('https://oracle-gateway-1.a.redstone.finance/data-packages/latest/redstone-avalanche-prod')).json();
    let result = [];
    for(const symbol of tokenSymbols){
        result.push(getPriceWithLatestTimestamp(redstonePrices, symbol));
    }
    return result;
}

async function getAccountDollarValue(accountAddress){
    const assetToAddress = {
        "AVAX": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        "USDC": "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
        "sAVAX": "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE",
        "ETH": "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab",
        "BTC": "0x152b9d0FdC40C096757F570A51E494bd4b943E50",
        "USDT": "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
        "QI": "0x8729438eb15e2c8b576fcc6aecda6a148776c0f5",
        "PNG": "0x60781C2586D68229fde47564546784ab3fACA982",
        "PTP": "0x22d4002028f537599bE9f666d1c4Fa138522f9c8",
        "JOE": "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd"
    }

    const provider = new ethers.providers.JsonRpcProvider(avalancheRPCurl);
    const avaxBalance = await provider.getBalance(accountAddress);

    let i = 0;
    let totalDollarValue = 0;
    const tokensPrices = await getRedstonePrices(Object.keys(assetToAddress));

    const wallet = new ethers.Wallet(knownPrivateKey, provider);
    for(const [asset, address] of Object.entries(assetToAddress)){
        let tokenContract = new ethers.Contract(address, IERC20_ABI, wallet);
        let decimals = await tokenContract.decimals();

        let balance = await tokenContract.balanceOf(accountAddress);
        balance = Number(formatUnits(balance, decimals));
        if(asset === "AVAX"){
            balance += parseFloat(ethers.utils.formatEther(avaxBalance));
        }

        let value = tokensPrices[i] * balance;
        totalDollarValue += value;

        i++;
    }
    return totalDollarValue;
}

async function getStabilityPoolSize(con){
    const q = `SELECT address, isAvailable, avaxLeft FROM PrivateKeys ORDER BY avaxLeft DESC`;
    const keysDetails = await query(con, q);
    let totalValue = 0;
    console.log(`Calculating stability pool $value...`)
    for(const keyDetails of keysDetails){
        let value = await getAccountDollarValue(keyDetails.address);
        totalValue += value;
    }
    console.log(`Success.`)
    console.log(`Stability pool value: $${totalValue}`);
}

export const handler = async (event) => {
    let connection = getDbConnection();

    if(event.createPrimeAccountsDBTable){
        console.log('Creating PrimeAccounts table')
        await createPrimeAccountsDBTable(connection);
    }

    if(event.createPrivateKeysDBTable){
        console.log('Creating PrivateKeys table')
        await createPrivateKeysDBTable(connection);
    }

    if(event.createStringToNumberTableDBTable){
        console.log('Creating StringToNumberTable table')
        await createStringToNumberTableDBTable(connection);
    }

    if(event.deletePrimeAccountsDBTable){
        console.log('Deleting PrimeAccounts table')
        await deletePrimeAccountsDBTable(connection);
    }

    if(event.deletePrivateKeysDBTable){
        console.log('Deleting PrivateKeys table')
        await deletePrivateKeysDBTable(connection);
    }

    if(event.deleteStringToNumberTableDBTable){
        console.log('Deleting StringToNumberTable table')
        await deleteStringToNumberTableDBTable(connection);
    }

    if(event.logExistingTables){
        await listAllTables(connection);
    }

    if(event.getPrimeAccountsCount){
        await getPrimeAccountsCount(connection);
    }

    if(event.getPrivateKeysCount){
        await getPrivateKeysCount(connection);
    }

    if(event.getStringToNumberTableCount){
        await getStringToNumberTableCount(connection);
    }

    if(event.initializeLastUsedBlock){
        await initializeLastUsedBlock(connection);
    }

    if(event.initializeLastUsedFailedTxsBlock){
        await initializeLastUsedFailedTxsBlock(connection);
    }

    if(event.addPrivateKey){
        await addPrivateKey(connection, event.keyAddress, event.keyPrivate);
    }

    if(event.getLoansBelowHRThreshold){
        await getLoansBelowHRThreshold(connection, event.insolvencyThreshold);
    }

    if(event.getInsolventAccounts){
        await getInsolventAccounts(connection);
    }

    if (event.getPACreationEventsLastUsedBlockFromDb){
        console.log(`Last used block: ${Object.entries(await getPACreationEventsLastUsedBlockFromDb(connection))}`)
    }

    if (event.getLastUsedFailedTxsBlockFromDb){
        console.log(`Last used block: ${Object.entries(await getLastUsedFailedTxsBlockFromDb(connection))}`)
    }

    if (event.checkStatusOfPrimeAccount){
        await checkStatusOfPrimeAccount(connection, event.PaStatusCheckAddress);
    }

    if(event.checkPrivateKeysStatus){
        await checkPrivateKeysStatus(connection);
    }

    if(event.checkSpreadSurplus){
        await checkSpreadSurplus();
    }

    if(event.checkPTPHackStatistics){
        await checkPTPHackStatistics(connection);
    }

    if(event.setKeysToAvailable){
        await setKeysToAvailable(connection);
    }

    if(event.setKeysToUnAvailable){
        await setKeysToUnAvailable(connection);
    }

    if(event.checkPTPUSDCTotalBorrowersExposure){
        await checkPTPUSDCTotalBorrowersExposure(connection);
    }

    if(event.checkSQLQuery){
        await checkSQLQuery(connection);
    }

    if(event.resetLastUsedBlock){
        await resetLastUsedBlock(connection);
    }

    if(event.getStabilityPoolSize){
        await getStabilityPoolSize(connection);
    }

    if(event.checkUSDTUSDTeSHExposure){
        await checkUSDTUSDTeSHExposure(connection);
    }

    if(event.checkEveryProtocolExposure){
        await checkEveryProtocolExposure(connection);
    }

    closeDbConnection(connection);

    return {
        statusCode: 200,
        body: JSON.stringify(`GOOD`),
    };
};