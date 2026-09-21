// Adds (or re-keys) a team member: a Supabase Auth user with a generated password, shown once and stored
// nowhere here, plus the team_members row with the display name attendees will see on their replies.
// Run: npm run team:add -- --email william@leadogo.com --name "William"
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
if (!values.email || !values.name) throw new Error("--email and --name are required");
const email = values.email.trim().toLowerCase();
const password = randomBytes(12).toString("base64url");

const admin = db().auth.admin;
let id: string;
const created = await admin.createUser({ email, password, email_confirm: true });
if (created.data.user) {
  id = created.data.user.id;
} else {
  // Already registered: rotate the password so the printed one works.
  const { data: list, error } = await admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) throw created.error ?? new Error("could not create or find the user");
  const updated = await admin.updateUserById(existing.id, { password });
  if (updated.error) throw updated.error;
  id = existing.id;
}

const { error } = await db().from("team_members").upsert({ id, email, display_name: values.name }, { onConflict: "id" });
if (error) throw error;
console.log(`team member ${email} ("${values.name}")\npassword (shown once): ${password}`);
