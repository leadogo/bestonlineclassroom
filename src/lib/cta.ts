// The CTA link the room shows at the scripted moment: the event's href plus the registrant's own fields (so the
// booking page is prefilled) plus the attribution the room link carried in. Built on the server, so the
// browser only ever sees the finished URL.
import { withQuery } from "./params.ts";

export type CtaFields = { first_name: string; email: string | null; phone: string | null; rid: string };

export function ctaHref(base: string, fields: CtaFields, params: Record<string, string>): string {
  return withQuery(base, { ...params, first_name: fields.first_name, email: fields.email, phone: fields.phone, rid: fields.rid });
}
