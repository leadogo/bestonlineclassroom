// Copy and proof for the replay page (SPEC-replay.md). Testimonials are copied verbatim from bms-website's
// lib/embed-testimonials.ts (the agent's actual words, "Verified Book More Showings Agent"); do not paraphrase.
// The admin UI will own this later; until then it is edited here.

export const REPLAY_COPY = {
  kicker: "Your replay of the AI For Agents Masterclass",
  headline: "How agents book appointments with an AI setter instead of cold calling",
  sub: "Watch the full training now, then lock in your strategy call. Pause and come back any time.",
  ctaLead: "Ready to see it working for you?",
  ctaLeadHot: "This is the part where people book their call.",
  recapTitle: "On your strategy call",
  recap: ["See whether the AI appointment setter fits your market and your leads.", "Walk through exactly how it books appointments on your calendar.", "Get every question answered. No pressure, no jargon."],
  proofTitle: "Agents who did this",
  faqTitle: "Quick answers",
  faq: [
    ["Do I have to watch all of it before booking?", "No. Book whenever you're ready; the call covers what you missed."],
    ["Can I watch on my phone?", "Yes. Turn it sideways for a bigger picture. Your spot is saved if you leave."],
    ["Who is the call with?", "A real person from William's team, not a sales robot."],
  ] as Array<[string, string]>,
  after: "Questions? Reply to the email your link came in and a real person answers.",
  expiresLead: "Your replay access ends in",
  expiredHeadline: "Your replay access has ended",
  expiredSub: "The recording was available for 72 hours after you first opened it. You can still book your call, or register for the next live session.",
};

export type Testimonial = { name: string; brokerage: string; title: string; quote: string; photo: string };

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Derrick Chan",
    brokerage: "eXp Realty · Greater Toronto, ON",
    title: "21 Appointments in 30 Days",
    quote: "Within one month we booked 21 appointments and closed our first deal in 7 days.",
    photo: "https://assets.cdn.filesafe.space/SqrY0CX9neekin6R6Xrh/media/699b5ea720c03562741706c8.png",
  },
  {
    name: "Moncef Zaghry",
    brokerage: "Groupe Sutton · Montreal, QC",
    title: "15 Deals Closed in 12 Months",
    quote: "I completed 15 deals within my first year.",
    photo: "https://assets.cdn.filesafe.space/SqrY0CX9neekin6R6Xrh/media/699b5ea755d8bcc86f56b272.png",
  },
  {
    name: "Zaher Muhareb",
    brokerage: "eXp Realty · Edmonton, AB",
    title: "6 Deals Per Month",
    quote: "A big credit to my success was actually using my CRM and implementing BMS teachings consistently.",
    photo: "https://assets.cdn.filesafe.space/SqrY0CX9neekin6R6Xrh/media/699b5ea720c0351ff91706ca.png",
  },
];
