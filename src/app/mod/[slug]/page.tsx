import { ModSeat } from "../page";

export const dynamic = "force-dynamic";

/** A moderator's own link: /mod/<webinar>, optionally ?date=. */
export default async function ModBySlug({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ date?: string }> }) {
  const { slug } = await params;
  const { date } = await searchParams;
  return <ModSeat slug={slug} date={date} />;
}
