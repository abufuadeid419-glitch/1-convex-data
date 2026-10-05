import { QueryCtx, MutationCtx } from "./_generated/server";

// ---- id / time helpers (mirror server.py new_id / iso / gen_code) ----
export const nowIso = () => new Date().toISOString();
export const newId = () => (globalThis.crypto as Crypto).randomUUID().replace(/-/g, "");
export const genCode = (prefix = "") => {
  const seg = () => Math.random().toString(16).slice(2, 6).toUpperCase().padStart(4, "0");
  return prefix + [seg(), seg(), seg()].join("-");
};

// Strip Convex system fields so results match the old Mongo/JSON shape the app expects.
export function clean<T extends Record<string, any>>(doc: T | null): any {
  if (!doc) return doc;
  const { _id, _creationTime, ...rest } = doc as any;
  return rest;
}
export const cleanAll = (docs: any[]) => docs.map(clean);

// ---- auth (mirror server.py get_user / require) ----
export async function getUser(ctx: QueryCtx, token?: string) {
  if (!token) throw new Error("غير مصرح");
  const sess = await ctx.db
    .query("user_sessions")
    .withIndex("by_token", (q) => q.eq("session_token", token))
    .unique();
  if (!sess) throw new Error("الجلسة غير صالحة");
  const exp = sess.expires_at;
  const expMs = typeof exp === "number" ? exp : exp ? Date.parse(exp) : 0;
  if (expMs && expMs < Date.now()) throw new Error("انتهت الجلسة");
  const user = await ctx.db
    .query("users")
    .withIndex("by_user_id", (q) => q.eq("user_id", sess.user_id))
    .unique();
  if (!user) throw new Error("المستخدم غير موجود");
  return user;
}

export function roleKey(user: any): string | null {
  return user.role === "EMPLOYEE" ? user.employee_type ?? null : user.role ?? null;
}

export async function orgById(ctx: QueryCtx, org_id?: string | null) {
  if (!org_id) return null;
  return await ctx.db
    .query("organizations")
    .withIndex("by_biz_id", (q) => q.eq("id", org_id))
    .unique();
}

// Role gate equivalent to server.py require(*roles). Returns the user or throws.
export async function require(ctx: QueryCtx, token: string | undefined, roles: string[]) {
  const user = await getUser(ctx, token);
  const key = roleKey(user);
  if (!key || !roles.includes(key)) throw new Error("ليس لديك صلاحية");
  if (key !== "DEVELOPER") {
    const org = await orgById(ctx, user.org_id);
    if (!org || org.status !== "ACTIVE") throw new Error("اشتراك المؤسسة غير فعال");
    if (org.expires_at && Date.parse(org.expires_at) < Date.now()) throw new Error("انتهى اشتراك المؤسسة");
  }
  return user;
}

export const OWNER = ["OWNER"];
export const STAFF = ["OWNER", "ACCOUNTANT"];
export const AGENT = ["FIELD_AGENT"];
export const ANY_ORG = ["OWNER", "ACCOUNTANT", "FIELD_AGENT"];
export const DEV = ["DEVELOPER"];

export const isAgent = (user: any) => user.employee_type === "FIELD_AGENT";

// ---- counters (mirror next_no) ----
export async function nextNo(ctx: MutationCtx, org_id: string, kind: string, prefix: string) {
  const existing = await ctx.db
    .query("counters")
    .withIndex("by_org_kind", (q) => q.eq("org_id", org_id).eq("kind", kind))
    .unique();
  const n = (existing?.n ?? 0) + 1;
  if (existing) await ctx.db.patch(existing._id, { n });
  else await ctx.db.insert("counters", { org_id, kind, n });
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

// ---- stock movement log (mirror log_movement) ----
export async function logMovement(
  ctx: MutationCtx,
  org_id: string,
  product_id: string,
  product_name: string,
  type: string,
  qty: number,
  byName: string | null,
  byRole = "OWNER",
) {
  await ctx.db.insert("stock_movements", {
    org_id,
    product_id,
    product_name,
    type,
    qty,
    by: byName,
    by_role: byRole,
    at: nowIso(),
  });
}

// ---- lookups by business string id ----
export async function docById(ctx: QueryCtx, table: any, id: string) {
  return await ctx.db.query(table).withIndex("by_biz_id", (q: any) => q.eq("id", id)).unique();
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
