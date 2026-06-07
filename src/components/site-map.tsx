"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteBrief } from "@/types/site-brief";
import "maplibre-gl/dist/maplibre-gl.css";

type SiteMapProps = {
  brief: SiteBrief;
  mapTilerKey?: string;
};

export function SiteMap({ brief, mapTilerKey }: SiteMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"map" | "static">(
    mapTilerKey ? "map" : "static",
  );

  useEffect(() => {
    if (!mapTilerKey || !ref.current) {
      setMode("static");
      return;
    }

    let dispose: (() => void) | undefined;
    let cancelled = false;

    async function bootMap() {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !ref.current) {
        return;
      }

      const map = new maplibre.Map({
        container: ref.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`,
        center: [brief.coordinates.lng, brief.coordinates.lat],
        zoom: 9,
        attributionControl: false,
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        new maplibre.Marker({ color: "#B4532E" })
          .setLngLat([brief.coordinates.lng, brief.coordinates.lat])
          .addTo(map);
      });

      dispose = () => map.remove();
    }

    bootMap().catch(() => setMode("static"));

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [brief, mapTilerKey]);

  return (
    <div className="map-shell">
      {mode === "map" ? <div ref={ref} className="h-full min-h-[360px]" /> : null}
      {mode === "static" ? (
        <div className="static-map">
          <div className="map-crosshair" />
          <div>
            <p className="eyebrow">Map unavailable</p>
            <p className="font-mono text-lg">
              {brief.coordinates.lat.toFixed(4)}, {brief.coordinates.lng.toFixed(4)}
            </p>
            <p className="mt-3 max-w-sm text-sm text-muted">
              Add a MapTiler key to show the interactive basemap. Coordinates
              and measured distances remain available.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
