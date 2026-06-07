import { NextResponse } from "next/server";
import { buildSiteBrief } from "@/lib/brief";
import type { SiteBrief, SiteBriefRequest } from "@/types/site-brief";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
): Promise<NextResponse<SiteBrief | { error: string }>> {
  try {
    const payload = (await request.json().catch(() => ({}))) as SiteBriefRequest;
    const brief = await buildSiteBrief(payload);
    return NextResponse.json(brief);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to assemble site brief.",
      },
      { status: 500 },
    );
  }
}
