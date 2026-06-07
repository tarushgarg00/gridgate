import examples from "../../data/example-sites.json";
import type {
  EiaContext,
  FloodContext,
  LandcoverContext,
  PeeringContext,
  SiteBriefRequest,
  Substation,
  TransmissionLine,
  WetlandsContext,
} from "@/types/site-brief";

export type ExampleSite = {
  id: string;
  name: string;
  inputLabel: string;
  coordinates: { lat: number; lng: number };
  state: string;
  region: string;
  transmission: TransmissionLine[];
  substations: Substation[];
  flood: FloodContext;
  wetlands: WetlandsContext;
  landcover: LandcoverContext;
  peering: PeeringContext;
  eia: EiaContext;
};

const exampleSites = examples as ExampleSite[];

export function getExampleSites(): ExampleSite[] {
  return exampleSites;
}

export function findExampleSite(request: SiteBriefRequest): ExampleSite | null {
  if (request.exampleId) {
    return exampleSites.find((site) => site.id === request.exampleId) ?? null;
  }

  if (request.query) {
    const normalized = request.query.trim().toLowerCase();
    return (
      exampleSites.find((site) =>
        [site.id, site.name, site.inputLabel]
          .map((value) => value.toLowerCase())
          .includes(normalized),
      ) ?? null
    );
  }

  if (request.coordinates) {
    return (
      exampleSites.find(
        (site) =>
          Math.abs(site.coordinates.lat - request.coordinates!.lat) < 0.02 &&
          Math.abs(site.coordinates.lng - request.coordinates!.lng) < 0.02,
      ) ?? null
    );
  }

  return null;
}
