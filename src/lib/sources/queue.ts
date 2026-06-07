import queueSummary from "../../../data/lbnl-queue-summary.json";
import type { QueueContext, SourceResult } from "@/types/site-brief";
import { ok, source, type SourceContext } from "./common";

type QueueSummary = {
  source: {
    name: string;
    url: string;
  };
  regions: Record<string, QueueContext>;
};

const summary = queueSummary as QueueSummary;

export async function getQueueContext(
  context: SourceContext,
): Promise<SourceResult<QueueContext>> {
  const data =
    summary.regions[context.region] ??
    summary.regions[context.state] ??
    summary.regions.PJM;

  return ok(
    data,
    source(summary.source.name, summary.source.url),
  );
}
