import {
  pgTable,
  varchar,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const rooms = pgTable("rooms", {
  id: varchar("id", { length: 150 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }),
  type: varchar("type", { length: 20 }).default("channel").notNull(), // 'channel' | 'group' | 'direct'
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
