import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const userStates = pgTable("user_states", {
  userId: text("user_id").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
