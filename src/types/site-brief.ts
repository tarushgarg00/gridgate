export type Recommendation = "Advance" | "Conditional" | "Do Not Advance";

export type SourceStatus = "ok" | "unavailable";

export type SourceRef = {
  name: string;
  url: string;
  accessedAt?: string;
};

export type SourceResult<T> =
  | {
      status: "ok";
      data: T;
      source: SourceRef;
    }
  | {
      status: "unavailable";
      data: null;
      source: SourceRef;
      reason: string;
    };

export type Coordinates = {
  lat: number;
  lng: number;
};

export type BBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type BuyBox = {
  targetMw: number;
  preferredHvDistanceMiles: number;
  preferredCarrierDistanceMiles: number;
  weights: ScoreWeights;
};

export type ScoreWeights = {
  power: number;
  fiber: number;
  flood: number;
  wetlands: number;
  landcover: number;
  zoning: number;
};

export type SiteBriefRequest = {
  exampleId?: string;
  query?: string;
  coordinates?: Coordinates;
  buyBox?: Partial<BuyBox> & {
    weights?: Partial<ScoreWeights>;
  };
};

export type DealKiller = {
  id: string;
  label: string;
  detail: string;
  source: SourceRef;
};

export type TransmissionLine = {
  id: string;
  voltageKv: number | null;
  voltageClass: string | null;
  owner: string | null;
  status: string | null;
  type: string | null;
  distanceMiles: number | null;
  sourceSubstation: string | null;
  targetSubstation: string | null;
  geometry?: GeoJSON.LineString | GeoJSON.MultiLineString;
};

export type Substation = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  maxVoltageKv: number | null;
  minVoltageKv: number | null;
  lineCount: number | null;
  distanceMiles: number | null;
};

export type QueueContext = {
  region: string;
  activeProjects: number;
  activeMw: number;
  typicalWaitYears: number;
  congestionLevel: "Low" | "Moderate" | "High" | "Severe";
  note: string;
};

export type EiaContext = {
  state: string;
  respondent: string;
  industrialPriceCentsKwh: number | null;
  pricePeriod: string | null;
  gridMix: Array<{
    fuel: string;
    valueMwh: number;
    share: number;
  }>;
};

export type FloodContext = {
  zone: string | null;
  subtype: string | null;
  sfha: boolean;
  baseFloodElevation: number | null;
  depth: number | null;
};

export type WetlandsContext = {
  intersectsWetland: boolean;
  features: Array<{
    attribute: string;
    type: string;
    acres: number | null;
  }>;
  extensive: boolean;
};

export type LandcoverContext = {
  className: string | null;
  signal: "favorable" | "mixed" | "dense-urban" | "manual-check";
  humanReviewFlag: boolean;
  availabilityRisk: "clear-first-pass" | "unmeasured" | "likely-prohibitive";
  note: string;
};

export type PeeringContext = {
  nearestFacility: {
    id: number;
    name: string;
    distanceMiles: number;
    city: string;
    state: string;
    networkCount: number;
    ixCount: number;
  } | null;
  facilitiesWithin25Miles: number;
};

export type ZoningContext = {
  status: "manual-check";
  jurisdiction: string;
  url: string;
  note: string;
};

export type PowerMetrics = {
  nearestHvLine: TransmissionLine | null;
  nearestLine: TransmissionLine | null;
  nearestSubstation: Substation | null;
  queue: SourceResult<QueueContext>;
  eia: SourceResult<EiaContext>;
  readinessScore: number;
  honestyLine: string;
};

export type ScoreComponent = {
  key: keyof ScoreWeights;
  label: string;
  score: number;
  weight: number;
  inputs: string[];
  source: SourceRef;
};

export type SiteScore = {
  total: number;
  uncappedTotal: number;
  recommendation: Recommendation;
  confidenceCap: {
    applied: boolean;
    maxScore: number | null;
    reason: string | null;
  };
  components: ScoreComponent[];
};

export type MapOverlay = {
  site: Coordinates;
  radiusMiles: number[];
  transmission: TransmissionLine[];
  substations: Substation[];
};

export type SiteBrief = {
  id: string;
  name: string;
  inputLabel: string;
  coordinates: Coordinates;
  state: string;
  region: string;
  buyBox: BuyBox;
  recommendation: Recommendation;
  score: SiteScore;
  keyRisks: string[];
  dealKillers: DealKiller[];
  sources: {
    geocode: SourceResult<{ matchedAddress: string; coordinates: Coordinates }>;
    transmission: SourceResult<TransmissionLine[]>;
    substations: SourceResult<Substation[]>;
    queue: SourceResult<QueueContext>;
    eia: SourceResult<EiaContext>;
    flood: SourceResult<FloodContext>;
    wetlands: SourceResult<WetlandsContext>;
    landcover: SourceResult<LandcoverContext>;
    peering: SourceResult<PeeringContext>;
    zoning: SourceResult<ZoningContext>;
  };
  power: PowerMetrics;
  map: MapOverlay;
  narrative: string;
  humanJudgment: string[];
  generatedAt: string;
  isExample: boolean;
};

export const defaultBuyBox: BuyBox = {
  targetMw: 100,
  preferredHvDistanceMiles: 5,
  preferredCarrierDistanceMiles: 25,
  weights: {
    power: 40,
    fiber: 15,
    flood: 15,
    wetlands: 10,
    landcover: 10,
    zoning: 10,
  },
};
