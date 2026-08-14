import { relations } from 'drizzle-orm';
import { boolean, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const roomStatusEnum = pgEnum('room_status', ['active', 'ended']);
export const roomMemberRoleEnum = pgEnum('room_member_role', ['host', 'participant', 'guest']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomCode: varchar('room_code', { length: 12 }).notNull().unique(),
  hostMemberId: uuid('host_member_id').notNull(),
  hostId: uuid('host_id').references(() => users.id, { onDelete: 'set null' }),
  status: roomStatusEnum('status').notNull().default('active'),
  permissions: text('permissions').notNull(),
  playbackState: text('playback_state').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true })
});

export const roomMembers = pgTable('room_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  role: roomMemberRoleEnum('role').notNull().default('guest'),
  isConnected: boolean('is_connected').notNull().default(true),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true })
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  senderName: varchar('sender_name', { length: 120 }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const roomRelations = relations(rooms, ({ one, many }) => ({
  host: one(users, {
    fields: [rooms.hostId],
    references: [users.id]
  }),
  members: many(roomMembers),
  messages: many(chatMessages)
}));

export const roomMemberRelations = relations(roomMembers, ({ one }) => ({
  room: one(rooms, {
    fields: [roomMembers.roomId],
    references: [rooms.id]
  }),
  user: one(users, {
    fields: [roomMembers.userId],
    references: [users.id]
  })
}));

export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
  room: one(rooms, {
    fields: [chatMessages.roomId],
    references: [rooms.id]
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id]
  })
}));

export const authSessionRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id]
  })
}));