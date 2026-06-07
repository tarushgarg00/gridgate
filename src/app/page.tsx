import { SiteScreener } from "@/components/site-screener";
import { exampleOptions } from "@/lib/brief";

export default async function Home() {
  return (
    <SiteScreener
      examples={exampleOptions()}
      mapTilerKey={process.env.NEXT_PUBLIC_MAPTILER_KEY}
    />
  );
}
