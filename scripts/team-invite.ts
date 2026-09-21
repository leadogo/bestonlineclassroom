// Invite a team member from the terminal (same path as the Team page): the email carries a set-password link.
// Run: doppler run -c prd -- node scripts/team-invite.ts --email x@y.com --name "Sam from William's team" --role moderator --events ailg-r,test-run
import { parseArgs } from "node:util";
import { db } from "../src/lib/db.ts";
import { inviteMember } from "../src/lib/team.ts";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string", default: "moderator" }, events: { type: "string", default: "" }, by: { type: "string", default: "william@leadogo.com" } } });
if (!values.email || !values.name) throw new Error("--email and --name are required");
const by = await db().from("team_members").select("id, display_name").eq("email", values.by!).single();
if (by.error) throw new Error(`inviter ${values.by}: ${by.error.message}`);
const slugs = values.events!.split(",").map((s) => s.trim()).filter(Boolean);
const ev = slugs.length ? await db().from("events").select("id, slug").in("slug", slugs) : { data: [] };
const missing = slugs.filter((s) => !(ev.data ?? []).some((e) => e.slug === s));
if (missing.length) throw new Error(`unknown events: ${missing.join(", ")}`);
const res = await inviteMember({ email: values.email, display_name: values.name, role: values.role === "admin" ? "admin" : "moderator", event_ids: (ev.data ?? []).map((e) => e.id as string), invited_by: by.data.id as string, inviter_name: by.data.display_name as string });
console.log(res.ok ? `invited ${values.email} as ${values.role} for ${slugs.join(", ") || "no webinars"}` : `failed: ${res.error}`);
