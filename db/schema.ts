import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
    code: text('code').primaryKey(),
    state: text('state').notNull(),
    revision: integer('revision').notNull().default(0),
    createdAt: integer('created_at').notNull(),
});
export const cardDocuments = sqliteTable('card_documents', {
    id: text('id').primaryKey(),
    xml: text('xml').notNull(),
    revision: integer('revision').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
});
export const decks = sqliteTable('decks', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    document: text('document').notNull(),
    revision: integer('revision').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
});
export const cardPoolSettings = sqliteTable('card_pool_settings', {
    id: text('id').primaryKey(),
    document: text('document').notNull(),
    revision: integer('revision').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
});
export const roomReplays = sqliteTable('room_replays', {
    code: text('code').notNull(), revision: integer('revision').notNull(),
    part: integer('part').notNull(), document: text('document').notNull(),
}, t => [primaryKey({ columns: [t.code, t.revision, t.part] })]);
