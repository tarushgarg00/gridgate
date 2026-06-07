"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EiaContext, QueueContext } from "@/types/site-brief";

type PowerChartsProps = {
  eia: EiaContext | null;
  queue: QueueContext | null;
};

export function PowerCharts({ eia, queue }: PowerChartsProps) {
  const mixData =
    eia?.gridMix.map((item) => ({
      fuel: item.fuel,
      share: Math.round(item.share * 100),
    })) ?? [];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="chart-panel">
        <h3>Supply mix</h3>
        {mixData.length > 0 ? (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={mixData}>
              <CartesianGrid stroke="#E7E5E4" vertical={false} />
              <XAxis dataKey="fuel" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} unit="%" />
              <Tooltip cursor={false} />
              <Bar dataKey="share" fill="#0D0D0C" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="empty-note">Supply mix unavailable.</p>
        )}
      </div>
      <div className="chart-panel">
        <h3>Regional queue</h3>
        {queue ? (
          <div className="queue-stat">
            <p className="eyebrow">{queue.region} queue</p>
            <p className="font-mono text-4xl text-conditional">
              {queue.typicalWaitYears}
              <span className="ml-2 text-base text-muted">years</span>
            </p>
            <p className="mt-3 text-sm text-muted">
              Typical interconnection wait. {queue.activeProjects.toLocaleString()} active
              projects / {Math.round(queue.activeMw / 1000).toLocaleString()} GW in the regional queue.
            </p>
            <p className="mt-2 font-mono text-xs uppercase text-muted">
              Queue pressure: {queue.congestionLevel}
            </p>
          </div>
        ) : (
          <p className="empty-note">Queue context unavailable.</p>
        )}
      </div>
    </div>
  );
}
