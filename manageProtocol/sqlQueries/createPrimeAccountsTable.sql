CREATE TABLE `PrimeAccounts` (
    `address` varchar(42) NOT NULL,
    `owner` varchar(42) NOT NULL,
    `isSolvent` BOOLEAN NOT NULL DEFAULT false,
    `liquidationInProgress` BOOLEAN NOT NULL DEFAULT false,
    `healthRatio` DECIMAL(36) NOT NULL DEFAULT '0',
    `totalValueUSD` DECIMAL(36) NOT NULL DEFAULT '0',
    `debtUSD` DECIMAL(36) NOT NULL DEFAULT '0',
    `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `insolventSince` DATETIME DEFAULT NULL,
    PRIMARY KEY (`address`));