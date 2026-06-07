import { SiteScreener } from "@/components/site-screener";
import { buildSiteBrief, exampleOptions } from "@/lib/brief";

export default async function Home() {
  const initialBrief = await buildSiteBrief({ exampleId: "lebanon-in" });

  return (
    <SiteScreener
      initialBrief={initialBrief}
      examples={exampleOptions()}
      mapTilerKey={process.env.NEXT_PUBLIC_MAPTILER_KEY}
    />
  );
}
