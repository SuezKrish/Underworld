CREATE TABLE `card_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`xml` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
