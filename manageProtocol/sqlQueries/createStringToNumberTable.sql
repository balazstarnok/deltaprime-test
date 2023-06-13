CREATE TABLE `StringToNumberTable` (
    `stringKey` varchar(256) NOT NULL,
    `numberValue` DECIMAL(36) NOT NULL DEFAULT '0',
    PRIMARY KEY (`stringKey`));