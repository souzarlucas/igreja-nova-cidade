export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function hashPassword(
  password: string,
  salt = crypto.randomUUID(),
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
    },
    key,
    256,
  );
  return (
    salt +
    ":" +
    Array.from(new Uint8Array(bits))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  );
}
export async function verifyPassword(password: string, stored: string) {
  const candidate = await hashPassword(password, stored.split(":")[0]);
  let diff = candidate.length ^ stored.length;
  for (let i = 0; i < stored.length; i++)
    diff |= stored.charCodeAt(i) ^ (candidate.charCodeAt(i) || 0);
  return diff === 0;
}
export function launchAllowed(day: number, now = new Date()) {
  return (
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Manaus",
        day: "numeric",
      }).format(now),
    ) <= day
  );
}
export function canWrite(role: string, kind: string) {
  return (
    ["admin", "presbytery"].includes(role) ||
    (role === "treasury" && ["budgets", "expenses"].includes(kind)) ||
    (role === "ministry" && kind === "events")
  );
}
