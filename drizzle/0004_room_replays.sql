CREATE TABLE IF NOT EXISTS `room_replays` (
	`code` text NOT NULL,
	`revision` integer NOT NULL,
	`part` integer NOT NULL,
	`document` text NOT NULL,
	PRIMARY KEY(`code`, `revision`, `part`)
);
