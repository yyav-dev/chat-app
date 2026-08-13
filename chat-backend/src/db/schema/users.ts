import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 100 }).notNull(),

  email: varchar("email", { length: 150 })
    .notNull()
    .unique(),

  password: varchar("password", { length: 255 })
    .notNull(),

  isOnline: boolean("is_online")
    .default(false),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
});