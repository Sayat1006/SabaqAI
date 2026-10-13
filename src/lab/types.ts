// 3D физика зертханасының негізгі типтері (7–11 сынып).

export type Grade = 7 | 8 | 9 | 10 | 11;

/** Физикалық шама: аты, белгісі, өлшем бірлігі. */
export interface Quantity {
  symbol: string;
  name: string;
  unit: string;
}

/** Зертханадағы формула: көрсетілетін түрі және оны есептейтін функция. */
export interface Formula {
  id: string;
  /** Оқушыға көрсетілетін жазылуы, мыс. «I = U / R». */
  expression: string;
  description: string;
  variables: Quantity[];
}

export type EquipmentKind =
  | "power-supply"
  | "ammeter"
  | "voltmeter"
  | "resistor"
  | "bulb"
  | "switch"
  | "wire"
  | "ruler"
  | "stopwatch"
  | "dynamometer"
  | "weight"
  | "pendulum"
  | "lens"
  | "screen"
  | "candle"
  | "thermometer"
  | "calorimeter"
  | "beaker"
  | "magnet"
  | "prism";

/** Үстелдегі құрал. */
export interface Equipment {
  id: string;
  kind: EquipmentKind;
  name: string;
  /** Өлшеу шегі немесе номиналы (мыс. 3 А, 5 Ом, 100 г). */
  range?: { min: number; max: number; unit: string };
  /** Бөлік құны. */
  division?: number;
  draggable?: boolean;
}

/** Деректер кестесінің бір жолы: баған кілті → мән. */
export interface Measurement {
  id: string;
  time: number;
  values: Record<string, number>;
}

/** Деректер кестесінің бағаны. */
export interface MeasurementColumn extends Quantity {
  key: string;
  digits?: number;
}

export interface LabWork {
  id: string;
  grade: Grade;
  /** Бөлім, мыс. «Механика негіздері». */
  module: string;
  title: string;
  emoji: string;
  goal: string;
  theory: string;
  steps: string[];
  equipment: Equipment[];
  formulas: Formula[];
  columns: MeasurementColumn[];
  /** Интерактивті 3D сахнасы дайын ба. */
  ready: boolean;
}

export interface GradeModule {
  grade: Grade;
  title: string;
  topics: string[];
}
