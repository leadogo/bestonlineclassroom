// The confirmation email (William's template, 2026-09-20) and the footer his email marketer appends. Placeholders
// in either style: {{first_name}} or #EVENT_LINK#. Edited per event in /admin; these are the defaults.

/** Jeremy (2026-09-20): name the event and the time, say the link is inside. */
export const CONFIRMATION_SUBJECT = "You're in for AI For Agents on #WEBINAR_DATE# (#WEBINAR_TIME#) + your join link";

export const CONFIRMATION_BODY = `Hi #FIRST_NAME#,

You're officially locked in for the training at #WEBINAR_TIME# on #WEBINAR_DATE#.

Here is your unique link!
#EVENT_LINK#

I'm gonna show you EXACTLY how I went from my car breaking down after my first showing…

To closing $1M+ in commissions in my first 34 months with ZERO experience…

And now I have a small team and still sell houses without actually having to open the doors. ✨

(And how hundreds of agents across 250+ markets have gotten better leads too using AI)

But, before we get into all of that…

Let me give you the important deets so you don't miss anything…

💡 WHAT: Discover How I Went From Zero to Over $1M in GCI in 34 Months With Qualifunnels & AI Appointment Setters (it's a virtual event, and it's 100% free)

WHEN: #WEBINAR_DATE# at #WEBINAR_TIME#. When it's time, click the link below to attend:

🔗 YOUR PRIVATE LINK TO JOIN:
#EVENT_LINK#

💻 ATTEND FROM A LAPTOP/COMPUTER: If you join from your phone, it will be hard to see all the important stuff on my screen. I know life happens, but if possible… join from a laptop so you get the full experience. (Use Google Chrome)

🎁 ATTENDEE BONUS #1: My FREE training and lead generation script that helped me land my first deal in 30 days as a new real estate agent with no sales skills

🎁 ATTENDEE BONUS #2: We've got a special bonus for those who attend about a tool we've built called Katherine AI that can book appointments for you… but you need to be there to know how to get it.

Now I know you're probably thinking…

"William. How do I know you're the real deal? As agents we're sold to all the time and there's so much garbage out there."

I don't want to try and prove myself over an email… But here's what I will say:

Using technology (especially AI with Facebook Ads) is the fastest, easiest, and most accessible way for agents like us to get deals in 30–60 days.

WITHOUT needing to post on social media all day, cold call bad leads, or door knock.

You just need your phone. Your Facebook account, and the willingness to talk to and actually help people.

We have dozens of testimonials on our website at bookmoreshowings.com of even new agents getting their first deal in a matter of weeks.

And that's exactly what I'm going to show you how to do.

Here are the important details to keep in mind before the event:

First, your seat is confirmed.

Now you just need to show up at #WEBINAR_TIME# on #WEBINAR_DATE#.

When you show up, three game-changing things happen:

✅ You'll learn the EXACT system I used to go from zero to $1M in GCI in 34 months (you don't need to be good with technology and I'll show you how to do this WITHOUT feeling salesy)

✅ You'll get my FREE training that I've given to hundreds of agents and team leaders on how to actually grow a real estate business the right way

Now, watch your inbox because you'll want to get everything I'm giving you for free.

Leading up to the workshop, expect some emails from me.

Sometimes they'll come from different emails, so keep an eye out for messages from "William" or Book More Showings.

You'll also get text reminders with time-sensitive info.

Look, I know it might seem like a lot… but I'd rather make SURE you don't miss this than let you slip through the cracks.

If our emails land in "Promotions" or "Spam," drag them to your main inbox ASAP. Do this for EVERY email from my team so you don't miss anything important.

Finally, bring an open mind… but maybe a little skepticism too.

What I'm revealing might make you go "yeah right, that sounds too good to be true. You're probably just like everyone else."

I get it. Because honestly, when people start my webinars they start out skeptical, but when I show them the AI booking a call, they completely change their mind.

The most life-changing opportunities often look deceptively simple. And this? This is one of them.

So here's what I need you to do right now:

1. Mark down the time of the event in your calendar — #WEBINAR_DATE# at #WEBINAR_TIME# (the invite is attached to this email)

2. Join our private Skool Group — the energy in there is AMAZING, plus you'll meet other realtors who are on the same journey as you! Join here: #SKOOL_LINK#

3. Get clear on your goals. Then come ready to make a plan to turn them into reality.

This is a training you do NOT want to miss. Here's your private link to attend on #WEBINAR_DATE# at #WEBINAR_TIME#.

#EVENT_LINK#

See you on the training!

— William Kabrall

Book More Showings — a subsidiary of Leadogo Companies LLC · #2 2207 90b St SW, Edmonton, AB T6X 1V8, Canada · 1309 Coffeen Ave STE 1200, Sheridan, WY 82801, USA`;

/**
 * The footer. Jeremy (2026-09-20): keep compliance, one line on why they got this, and the stop link; a 500-word
 * block hurts readability and can push mail to Promotions. William's marketer's long version is kept in git
 * history if he wants it back; the switch per event in /admin turns this short one on or off.
 */
export const TRANSPARENCY_FOOTER = `You're getting this because you registered for the AI For Agents Masterclass through one of our forms. We only send what you need for the session: this confirmation and two reminders. Reply to this email and a real person answers.`;

/** {{name}} and #NAME# both work; unknown names stay visible. */
export function fill(template: string, vars: Record<string, string>): string {
  const get = (k: string) => (k.toLowerCase() in vars ? vars[k.toLowerCase()] : null);
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k: string) => get(k) ?? m).replace(/#([A-Z_]+)#/g, (m, k: string) => get(k) ?? m);
}
