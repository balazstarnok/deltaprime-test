CREATE TABLE `PrivateKeys` (
	`address` VARCHAR(42) NOT NULL,
	`privateKey` VARCHAR(64) NOT NULL,
	`isAvailable` BOOLEAN NOT NULL,
	`avaxLeft` DECIMAL(36) NOT NULL,
	PRIMARY KEY (`address`)
);