import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  digest,
  launchAllowed,
  canWrite,
} from "../lib/security.ts";
test("passwords are salted and wrong passwords fail", async () => {
  const a = await hashPassword("a-long-test-password");
  const b = await hashPassword("a-long-test-password");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("a-long-test-password", a), true);
  assert.equal(await verifyPassword("incorrect", a), false);
  assert.notEqual(await digest("session-a"), await digest("session-b"));
});
test("monthly cutoff uses Manaus day and includes deadline", () => {
  assert.equal(launchAllowed(10, new Date("2026-10-11T03:59:00Z")), true);
  assert.equal(launchAllowed(10, new Date("2026-10-11T04:00:00Z")), false);
});
test("write matrix blocks financial writes for ministries and allows presbytery administration", () => {
  assert.equal(canWrite("ministry", "events"), true);
  assert.equal(canWrite("ministry", "expenses"), false);
  assert.equal(canWrite("treasury", "budgets"), true);
  assert.equal(canWrite("treasury", "members"), false);
  assert.equal(canWrite("presbytery", "events"), true);
  assert.equal(canWrite("admin", "settings"), true);
  assert.equal(canWrite("unknown", "events"), false);
});
