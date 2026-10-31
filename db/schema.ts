import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const userStates = pgTable("user_states", {
  userId: text("user_id").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

// Server-owned execution ledger, rules and snapshots share one locked aggregate.
// It is deliberately separate from the client-writable AppState JSON.
export const petCompanions=pgTable("pet_companions",{
  userId:text("user_id").primaryKey().references(()=>userStates.userId,{onDelete:"cascade"}),
  payload:text("payload").notNull(),revision:integer("revision").notNull().default(1),updatedAt:text("updated_at").notNull(),
});

export const sleepProfiles=pgTable("sleep_profiles",{
  userId:text("user_id").primaryKey().references(()=>userStates.userId,{onDelete:"cascade"}),
  settings:text("settings").notNull(),email:text("email").notNull(),
  revision:integer("revision").notNull().default(1),updatedAt:text("updated_at").notNull(),
});
export const sleepRecords=pgTable("sleep_records",{
  id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>sleepProfiles.userId,{onDelete:"cascade"}),
  sessionDate:text("session_date").notNull(),kind:text("kind").notNull(),plannedAt:text("planned_at").notNull(),checkedAt:text("checked_at").notNull(),
  actualAt:text("actual_at"),method:text("method").notNull(),updatedAt:text("updated_at").notNull(),
});
export const sleepDeliveries=pgTable("sleep_deliveries",{
  id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>sleepProfiles.userId,{onDelete:"cascade"}),
  revision:integer("revision").notNull(),sessionDate:text("session_date").notNull(),kind:text("kind").notNull(),
  plannedAt:text("planned_at").notNull(),status:text("status").notNull(),attemptedAt:text("attempted_at").notNull(),providerId:text("provider_id"),
});
