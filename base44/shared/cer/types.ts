// ===========================================================================
// CER — Cross-Environment Resonance. Types.
//
// CER is a separate module beside HEX. It reads across channels; HEX reads
// one series. Nothing in this directory is imported by observer.ts, hex7.ts,
// cycle.ts, ledger.ts, isotonic.ts or any function, and nothing here changes
// a call shown to a user. Reference: validation/cercore.py (parity test:
// tests/cer.mjs). Mathematics: docs/CER.md.
// ===========================================================================

export const CER_VERSION = 'cer-0.4.1';

/** One measurement as it arrives from a source, before anything is done to it. */
export interface SignalObservation {
  /** The device or feed. */
  source_id: string;
  /** Where it was measured: 'server A', 'room', 'markets'. */
  environment_id: string;
  /** What was measured there: 'mycelium_voltage', 'cpu_load'. A channel is one (source, environment, channel). */
  channel_id: string;
  /** When the quantity had this value (ms since 1970, UTC). */
  timestamp: number;
  /** When the value became available to us. A call may only use what had been acquired when it was made. */
  acquired_at?: number;
  /** 'voltage', 'temperature', 'price'. */
  measurement: string;
  /** Physical unit as measured. Kept as metadata: the engine ranks values and never mixes units. */
  unit: string;
  /** One number, or a vector (a spectrum, several electrodes). Vectors are split into channels before use. */
  value: number | number[] | null;
  sample_rate_hz?: number;
  calibration?: { applied: boolean; reference?: string; date?: string };
  /** Anything the sensor or the collector said about this sample: 'saturated', 'interpolated', 'drift suspected'. */
  quality?: string[];
  /** Experimental condition: 'live mycelium', 'dehydrated', 'control'. */
  condition?: string;
  /** A deliberate change made by the experimenter at this time: 'load step +50%'. */
  intervention?: string;
  provenance?: string;
  missing?: boolean;
}

/** One channel, ready to be read: a clock in whole ticks (days, for daily series) and the change at each tick. */
export interface Channel {
  id: string;
  env: string;
  unit: string;
  source: string;
  /** Tick of each observation, increasing. For daily series, days since 1970-01-01. */
  days: number[];
  /** The change that arrived at each tick. */
  changes: number[];
  /** Running sum of the changes. */
  level: number[];
  /** HEX's coordinates of this channel at each tick: 7 for the level, 7 for the size of the change. Filled by coordinates(). */
  Z?: Float64Array[];
  /** Each observation against the channel's own past: the normal score of its change, and the tail probability of its size. Filled by prepare(). */
  ns?: number[];
  tail?: number[];
  quality?: { observations: number; dropped_missing: number; dropped_flagged: number; duplicates: number };
}

export type EdgeStatus = 'ok' | 'insufficient data' | 'insufficient variation' | 'no other channel';
export type NotSupported = 'not supported';

/** One measured relation of an ordered pair, target <- source. Each kind is its own edge: they are never added into one score. */
export interface Edge {
  target: string;
  source: string;
  type: 'rank-xcorr' | 'partial-rank-xcorr' | 'coherence' | 'predictive';
  status: EdgeStatus;
  /** Analysis-method version. */
  method: string;
  /** Aligned observations the estimate rests on. */
  samples: number;
  /** First and last tick of the window the edge is valid for. */
  window: [number, number] | null;
  /** Share of ticks in the window on which both channels were observed. */
  coverage?: number;
  /** rank-xcorr: the correlation at the lag where it is largest. coherence: the band's highest coherence. predictive: bits per call of the edge's expert alone. */
  strength?: number;
  /** Steps by which the source leads the target. */
  lag?: number;
  by_lag?: number[];
  standard_error?: number;
  /** What the statistic has to exceed to be told from no relationship. */
  threshold?: number;
  p_value?: number;
  /** True when the measured association is told from no relationship. Association, never cause. */
  related?: boolean;
  /** partial-rank-xcorr: the channels whose shared movement was removed first. */
  controls?: string[];
  band?: [number, number];
  coherence?: number;
  mean_coherence?: number;
  segments?: number;
  frequencies?: number;
  period?: number;
  coherent?: boolean;
  phase?: number | NotSupported;
  neighbour_leads_by?: number | NotSupported;
}

/**
 * The measured weight of one edge at one moment: w = A . L . C . Q, from the
 * current observation window only. No outcome and no past forecasting
 * success enters it.
 */
export interface EdgeWeight {
  status: EdgeStatus;
  samples: number;
  /** Associative coherence: the largest |rank correlation| over lags 0..5. */
  A: number;
  /** Usable lead: the share of A at lags a call can use; 0 unless that part clears its own surrogate threshold. */
  L: number;
  /** Compatibility with the configuration: the share of the correlation at the chosen lag that survives removing the shared driver. */
  C: number;
  /** Measurement quality: the share of the target's ticks on which the neighbour was also observed, times how full the window is. */
  Q: number;
  /** A . L . C . Q. Zero means the relation is not promoted into the forecast; it may still be in the descriptive graph. */
  w: number;
  /** How far the usable lead, with the shared driver removed, stands above what no relationship produces, in nats. Zero unless detected. */
  evidence: number;
  lag?: number;
  threshold?: number;
  lead_strength?: number;
}

/** How the edges' experts are combined into CER's call. */
export type Weighting = 'moment' | 'reliability' | 'measurement' | 'relaxation' | 'relaxation-tempered';

/** One band of the rhythm between the target and a neighbour. Phase, with its own uncertainty, only where the band is coherent. */
export interface RhythmBand {
  band: [number, number]; status: EdgeStatus; coherence?: number; coherent: boolean;
  phase: number | NotSupported; neighbour_leads_by: number | NotSupported;
  phase_standard_error?: number; lead_standard_error?: number; period?: number;
}
/** Two neighbours together against the target. */
export interface Counterpoint { pair: [string, string]; strength: number; standard_error: number; z: number; pairs_tried: number; tail: number }

/**
 * The signature of one relational moment M_t = (X_t, G_t, Phi_t) as a target
 * meets it: what relates to what now (harmony), what moves before what
 * (leadership, following), what two channels carry together (counterpoint),
 * how it is organised in time (persistence, rhythm), what limits the
 * measurement (samples, coverage, standard errors) and what is new
 * (temporal_novelty here; intrinsic and relational novelty per call from
 * novelty()). `evidence` is kept apart: it is the controlled evidence that
 * the pool [0] or neighbour j [j + 1] bears on the target's next step.
 */
export interface MomentSignature {
  method: string; target: string; as_of: number; lag: number; read: 'MOVE' | 'RANGE'; samples: number; status: EdgeStatus;
  coverage: number[]; measurable: boolean[]; evidence: number[];
  /** Correlation matrix of the panel at the same step, target first. */
  H?: number[][];
  harmony?: number[]; leadership?: number[][]; following?: number[][]; persistence?: number[];
  standard_error?: number; edge_standard_error?: number[];
  counterpoint?: { same_step: Counterpoint | null; one_step_earlier: Counterpoint | null };
  rhythm?: Record<string, RhythmBand[]>;
  partial_leadership?: number[][]; chosen_lag?: number[]; log_likelihood_ratio?: number[]; pool_partial?: number;
  eligible?: string[];
  temporal_novelty?: { largest_change_z: number; edge: string; kind: 'harmony' | 'leadership'; tail: number; became_eligible: number; ceased_to_be_eligible: number; compared_with: number };
}

export interface Graph {
  method: string;
  as_of: number;
  nodes: { id: string; environment: string; unit: string; source: string; observations: number }[];
  edges: Edge[];
}
