import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getTeamMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Tokens for browser uploads straight to Blob (the 1.2 GB never passes through a function). Team only. */
export async function POST(request: Request) {
  if (!(await getTeamMember().catch(() => null))) return Response.json({ error: "Sign in" }, { status: 401 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^videos\/[a-z0-9-]+\.mp4$/.test(pathname)) throw new Error("Only videos/<event>-<random>.mp4");
        return { allowedContentTypes: ["video/mp4"], maximumSizeInBytes: 4 * 1024 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: true };
      },
      onUploadCompleted: async () => {
        /* the admin page calls setVideo() after the upload; nothing to do here */
      },
    });
    return Response.json(json);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Upload refused" }, { status: 400 });
  }
}
