import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

export const northCreekIndexTable = pgTable("north_creek_index", {
  id: integer("id").primaryKey(),
  pages: jsonb("pages").notNull().$type<unknown[]>(),
  events: jsonb("events").notNull().$type<unknown[]>(),
  status: jsonb("status").notNull().$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});