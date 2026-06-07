import Anthropic from "@anthropic-ai/sdk";
import type { SiteBrief } from "@/types/site-brief";

export type NarrativeInput = {
  brief: Omit<SiteBrief, "narrative"> & { narrative?: string };
};

export async function generateNarrative({
  brief,
}: NarrativeInput): Promise<string> {
  const deterministic = deterministicNarrative(brief);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return deterministic;
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 220,
      temperature: 0,
      system:
        "Rewrite the site-screening result in polished, plain English. Do not invent numbers, sources, scores, or conclusions. Preserve the recommendation and human-review boundary.",
      messages: [
        {
          role: "user",
          content: deterministic,
        },
      ],
    });
    const text = message.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();

    return text || deterministic;
  } catch {
    return deterministic;
  }
}

export function deterministicNarrative(
  brief: Omit<SiteBrief, "narrative"> & { narrative?: string },
): string {
  const risk = brief.keyRisks[0] ?? "No single priority risk dominates the initial screen.";
  const hv = brief.power.nearestHvLine;
  const substation = brief.power.nearestSubstation;
  const queue =
    brief.power.queue.status === "ok"
      ? `${brief.power.queue.data.region} queue pressure is ${brief.power.queue.data.congestionLevel.toLowerCase()} with a typical ${brief.power.queue.data.typicalWaitYears}-year wait.`
      : "Queue context is unavailable.";

  return `${brief.name} returns ${brief.recommendation} with a measured score of ${brief.score.total}. Primary readout: ${risk} Power context: nearest HV line ${
    hv ? `${hv.voltageKv ?? "unknown"} kV at ${hv.distanceMiles} miles` : "unavailable"
  }; nearest substation ${
    substation
      ? `${substation.maxVoltageKv ?? "unknown"} kV at ${substation.distanceMiles} miles`
      : "unavailable"
  }. ${queue} Actual load service still requires utility study, negotiation, permitting judgment, and capital decisions.`;
}
