// The CTA link the room shows at the scripted moment: the event's href plus the registrant's own details in the
// parameter names iClosed's scheduler reads (iclosedName, iclosedEmail, iclosedPhone: see
// intercom.help/iclosed → "How to prefill iClosed form"), plus `rid` for us and the attribution the room link
// carried in. Built on the server, so the browser only ever sees the finished URL.
import { withQuery } from "./params.ts";

export type CtaFields = { first_name: string; email: string | null; phone: string | null; rid: string };

/** iClosed wants digits only ("12345678590"), no plus sign or punctuation. */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function ctaHref(base: string, fields: CtaFields, params: Record<string, string>): string {
  return withQuery(base, { ...params, iclosedName: fields.first_name, iclosedEmail: fields.email, iclosedPhone: phoneDigits(fields.phone), rid: fields.rid });
}
