"use client";

import { useEffect, useState } from "react";
import { PowerCharts } from "@/components/power-charts";
import { SiteMap } from "@/components/site-map";
import { SourceTag } from "@/components/source-tag";
import type { SiteBrief, SiteBriefRequest } from "@/types/site-brief";

type ExampleOption = {
  id: string;
  name: string;
  inputLabel: string;
  coordinates: { lat: number; lng: number };
};

type SiteScreenerProps = {
  initialBrief: SiteBrief;
  examples: ExampleOption[];
  mapTilerKey?: string;
};

export function SiteScreener({
  initialBrief,
  examples,
  mapTilerKey,
}: SiteScreenerProps) {
  const [brief, setBrief] = useState(initialBrief);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBrief(initialBrief);
  }, [initialBrief]);

  async function requestBrief(payload: SiteBriefRequest) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as SiteBrief | { error: string };
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Brief request failed");
      }
      setBrief(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to assemble brief.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface text-ink">
      <div className="mx-auto grid w-full max-w-[1480px] gap-6 px-5 py-5 lg:grid-cols-[320px_1fr]">
        <aside className="sidebar-panel">
          <p className="eyebrow">Data center screening</p>
          <h1 className="font-display text-6xl font-semibold tracking-normal">
            GridGate
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Screen a U.S. location against power, flood, land, fiber, and
            queue constraints. GridGate assembles the measurable signals and
            marks the decisions that still require human review.
          </p>

          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void requestBrief({ query });
            }}
          >
            <label className="field-label" htmlFor="site-query">
              Location
            </label>
            <input
              id="site-query"
              className="text-input"
              value={query}
              placeholder="4600 Silver Hill Rd, Washington, DC"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="command-button" type="submit" disabled={loading}>
              {loading ? "Preparing brief..." : "Generate brief"}
            </button>
          </form>

          <div className="mt-8">
            <p className="field-label">Reference sites</p>
            <div className="mt-2 space-y-2">
              {examples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className="example-button"
                  onClick={() => void requestBrief({ exampleId: example.id })}
                >
                  <span>{example.name}</span>
                  <span className="font-mono text-[11px] text-muted">
                    {example.coordinates.lat.toFixed(4)},{" "}
                    {example.coordinates.lng.toFixed(4)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-5">
            <p className="field-label">Screening assumptions</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Target" value={`${brief.buyBox.targetMw} MW`} />
              <Metric
                label="HV pref."
                value={`${brief.buyBox.preferredHvDistanceMiles} mi`}
              />
              <Metric
                label="Fiber pref."
                value={`${brief.buyBox.preferredCarrierDistanceMiles} mi`}
              />
              <Metric label="Weights" value="40/15/15/10/10/10" />
            </dl>
          </div>
          {error ? <p className="mt-4 text-sm text-pass">{error}</p> : null}
        </aside>

        <section className="space-y-5">
          <section
            className={`verdict-strip ${verdictClassName(brief.recommendation)}`}
          >
            <div>
              <p className="eyebrow">Screening outcome</p>
              <h2 className="font-display text-5xl font-semibold tracking-normal">
                {brief.recommendation}
              </h2>
            </div>
            <div className="text-right">
              <p className="font-mono text-5xl">{brief.score.total}</p>
              <p className="text-sm text-muted">measured score</p>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel power-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Grid access</p>
                  <h2>Power readiness</h2>
                </div>
                <SourceTag source={brief.sources.transmission.source} label="HIFLD" />
              </div>
              <div className="metric-grid">
                <Metric
                  label="Nearest HV line"
                  value={
                    brief.power.nearestHvLine
                      ? `${brief.power.nearestHvLine.voltageKv ?? "?"} kV / ${brief.power.nearestHvLine.distanceMiles} mi`
                      : "Unavailable"
                  }
                />
                <Metric
                  label="Nearest substation"
                  value={
                    brief.power.nearestSubstation
                      ? `${brief.power.nearestSubstation.maxVoltageKv ?? "?"} kV / ${brief.power.nearestSubstation.distanceMiles} mi`
                      : "Unavailable"
                  }
                />
                <Metric
                  label="Queue context"
                  value={
                    brief.sources.queue.status === "ok"
                      ? `${brief.sources.queue.data.congestionLevel} / ${brief.sources.queue.data.typicalWaitYears} yr`
                      : "Unavailable"
                  }
                />
                <Metric
                  label="Industrial price"
                  value={
                    brief.sources.eia.status === "ok"
                      ? `${brief.sources.eia.data.industrialPriceCentsKwh ?? "?"} c/kWh`
                      : "Unavailable"
                  }
                />
              </div>
              <p className="honesty-line">{brief.power.honestyLine}</p>
              {brief.sources.queue.status === "ok" ? (
                <p className="mb-3 font-mono text-xs uppercase text-muted">
                  Queue region: {brief.sources.queue.data.region} inferred from{" "}
                  {brief.state} location
                </p>
              ) : null}
              <PowerCharts
                eia={brief.sources.eia.status === "ok" ? brief.sources.eia.data : null}
                queue={brief.sources.queue.status === "ok" ? brief.sources.queue.data : null}
              />
            </div>

            <div className="panel map-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Location context</p>
                  <h2>{brief.name}</h2>
                </div>
                <span className="font-mono text-xs text-muted">
                  {brief.coordinates.lat.toFixed(4)},{" "}
                  {brief.coordinates.lng.toFixed(4)}
                </span>
              </div>
              <SiteMap brief={brief} mapTilerKey={mapTilerKey} />
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Review first</p>
                  <h2>Priority risks</h2>
                </div>
              </div>
              <ul className="risk-list">
                {brief.keyRisks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
              {brief.dealKillers.length > 0 ? (
                <div className="deal-killer">
                  <p className="eyebrow">Critical constraint</p>
                  {brief.dealKillers.map((item) => (
                    <p key={item.id}>
                      {item.label}: {item.detail}{" "}
                      <SourceTag source={item.source} label="source" />
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Human review</p>
                  <h2>Decision areas</h2>
                </div>
              </div>
              <ul className="human-list">
                {brief.humanJudgment.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Evidence stack</p>
                <h2>Scored components</h2>
              </div>
            </div>
            <div className="layers-grid">
              {brief.score.components.map((component) => (
                <div key={component.key} className="layer-row">
                  <div>
                    <p className="font-medium">{component.label}</p>
                    <p className="mt-1 text-xs text-muted">
                      {component.inputs.join(" / ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl">
                      {component.score}/{component.weight}
                    </p>
                    <SourceTag source={component.source} label="source" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Brief</p>
                <h2>Executive readout</h2>
              </div>
            </div>
            <p className="leading-7 text-muted">{brief.narrative}</p>
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-ink">{value}</dd>
    </div>
  );
}

function verdictClassName(recommendation: SiteBrief["recommendation"]) {
  switch (recommendation) {
    case "Advance":
      return "verdict-advance";
    case "Conditional":
      return "verdict-conditional";
    case "Do Not Advance":
      return "verdict-do-not-advance";
  }
}
