/** Rating deltas applied to a ship (or other generated result). */
export type RatingMap = Record<string, number>;

/** A single selectable option in a generator collection. */
export interface GeneratorOption {
  id: string;
  name: string;
  category?: string;
  stakes: number;
  description: string;
  ratings?: RatingMap;
  tags?: string[];
  source: string;
  special?: string | null;
  /** Tool-specific free-form metadata (e.g. { requiresEngine: false } for sail bites). */
  meta?: Record<string, unknown>;
}

/** Selection rules for a collection. */
export interface SelectionRules {
  min: number;
  max: number | null;
  allowMultiple: boolean;
}

/** Constraints a caller can impose on a generated ship. */
export interface ShipConstraints {
  /** Force a specific size option id (e.g. "standard"). */
  sizeId?: string;
  /** Require one of the six ratings to land exactly on this value. */
  targetRating?: { key: string; value: number };
  /** Require the ship to spend exactly this many stakes. */
  targetStakes?: number;
}

/** One rendered section of a generated ship (a collection plus its picks). */
export interface GeneratedSection {
  key: string;
  title: string;
  description?: string;
  order: number;
  options: GeneratorOption[];
}

/** A complete generated ship result. */
export interface GeneratedShip {
  sections: GeneratedSection[];
  ratings: Record<string, number>;
  totalStakes: number;
  /** Human-readable notes, e.g. when a requested target could not be matched. */
  warnings?: string[];
}

/** A single JSON dataset for one generator. */
export interface OptionCollection {
  tool: string;
  collection: string;
  title: string;
  description?: string;
  order?: number;
  selection: SelectionRules;
  ratingKeys?: string[];
  options: GeneratorOption[];
}

/** A registered generator tool, read from the landing page. */
export interface ToolEntry {
  id: string;
  name: string;
  route: string;
  description: string;
  dataDir: string;
  status: 'active' | 'planned';
}

export interface ToolManifest {
  title: string;
  description: string;
  tools: ToolEntry[];
}
