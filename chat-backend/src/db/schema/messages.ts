import {
  pgTable,
  varchar,
  text,
  timestamp,
  uuid,
  index
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 150 }).primaryKey(),
    roomId: varchar("room_id", { length: 150 }).notNull(),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_room_id_created_at_idx").on(table.roomId, table.createdAt),
  ]
);
