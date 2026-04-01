export type SalsaType   = "cours" | "figures" | "solo";
export type SalsaStatus = "learning" | "acquired" | "mastered";

export const SALSA_STATUS_LABELS: Record<SalsaStatus, string> = {
  learning: "En apprentissage",
  acquired: "Acquis",
  mastered: "Maîtrisé",
};

export const SALSA_STATUS_CLASSES: Record<SalsaStatus, string> = {
  learning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  acquired: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  mastered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

export const SALSA_TYPE_LABELS: Record<SalsaType, string> = {
  cours:   "Programme de cours",
  figures: "Figures",
  solo:    "Solo",
};

export const SALSA_DEFAULT_TOPICS = [
  "Débutant", "Avancé", "Men styling", "Enshufla",
  "Footwork", "Partner work", "Body movement", "Musicality",
];

export interface SalsaMove {
  id:          string;
  type:        SalsaType;
  title:       string;
  description?: string;
  videoUrl?:   string;
  linkUrl?:    string;
  topics:      string[];
  status:      SalsaStatus;
  difficulty:  number;   // 0 = unrated, 1–5
  sortOrder:   number;
  notes?:      string;
  createdAt:   string;
}
