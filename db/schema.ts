import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    ministry: text("ministry").notNull().default(""),
    data: text("data").notNull(),
    budgetKey: text("budget_key"),
    updated: integer("updated").notNull(),
  },
  (t) => [
    index("records_kind_ministry").on(t.kind, t.ministry),
    uniqueIndex("budget_period_unique").on(t.budgetKey),
  ],
);
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  ministry: text("ministry").notNull().default(""),
  password: text("password").notNull(),
  active: integer("active").notNull().default(1),
});
export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expires: integer("expires").notNull(),
  },
  (t) => [
    index("session_user").on(t.userId),
    index("session_expiry").on(t.expires),
  ],
);
export const attempts = sqliteTable("attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  until: integer("until").notNull(),
});
export const audit = sqliteTable(
  "audit",
  {
    id: text("id").primaryKey(),
    user: text("user").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    time: integer("time").notNull(),
  },
  (t) => [index("audit_time").on(t.time)],
);
