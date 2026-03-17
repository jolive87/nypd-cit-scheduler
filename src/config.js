// ─── DEFAULT CONFIG ──────────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
  actors: ["Decatur","Sat Charn","Mara","Rumi","Rich","Antonia","Doc","Qurrat","Nicole","Edwin","Chris"],
  actorColors: {
    "Decatur":"#B84C3A","Sat Charn":"#3A7B6E","Mara":"#4A7BA8","Rumi":"#B8862E",
    "Rich":"#4A8B5C","Antonia":"#C46B5A","Doc":"#5A7FA0","Qurrat":"#8B5A8B",
    "Nicole":"#5AA088","Edwin":"#9B7340","Chris":"#6B5A8B"
  },
  scenarioActors: {
    "Mania":["Sat Charn","Doc","Antonia","Mara"],
    "Psychosis":["Rumi","Nicole","Sat Charn","Qurrat","Mara"],
    "Depression":["Decatur","Rich","Doc","Edwin","Nicole"],
    "PTSD":["Sat Charn","Antonia","Mara","Decatur","Rumi"],
    "Jumper":["Decatur","Rich","Doc","Edwin","Rumi"],
    "Borderline":["Antonia","Rumi","Sat Charn","Qurrat","Mara","Decatur","Edwin"],
    "Suicidal MOS":["Chris","Antonia","Sat Charn","Nicole"],
    "Dementia":["Decatur","Doc","Rumi","Qurrat"],
    "Autism":["Rich","Edwin","Rumi","Nicole"]
  },
  scenarioIcons: {
    "Mania":"⚡","Psychosis":"🌀","Depression":"🌧","PTSD":"🛡",
    "Jumper":"🚨","Borderline":"🔄","Suicidal MOS":"💙","Dementia":"🧠","Autism":"🧩"
  },
  slotScenarios: {
    "slot1":["Mania","Psychosis","Depression"],
    "slot2":["PTSD","Jumper","Borderline"],
    "slot3":["Suicidal MOS","Dementia","Autism"]
  },
  slotNames: { "slot1":"Day 1", "slot2":"Day 2", "slot3":"Day 3" },
  defaultDays: { "slot1":"Tuesday", "slot2":"Wednesday", "slot3":"Thursday" },
  conflicts: [{ actor_cannot_play:["Jumper","Depression"], scope:"same_shift" }],
  shiftTimes: { AM:"Noon", PM:"8 PM" },
  actorConstraints: {
    "Chris": { allowedDays: ["Thursday"] },
  },
  actorSortOrder: {
    "Decatur": 0, "Sat Charn": 1, "Mara": 2, "Rumi": 3, "Rich": 4,
    "Antonia": 5, "Doc": 6, "Qurrat": 7, "Nicole": 8, "Edwin": 9, "Chris": 10,
  },
};

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
export const ALL_WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
export const COLOR_PALETTE = ["#B84C3A","#3A7B6E","#4A7BA8","#B8862E","#4A8B5C","#C46B5A","#5A7FA0","#8B5A8B","#5AA088","#9B7340","#6B5A8B","#7B5A3A","#3A6B7B","#8B6B3A","#5A3A7B","#7B3A5A","#3A8B5A","#5A7B3A","#3A5A8B","#8B3A5A"];
export const ICON_OPTIONS = ["⚡","🌀","🌧","🛡","🚨","🔄","💙","🧠","🧩","🎭","🔥","💊","🌊","🏥","🫂","🪞","⚠️","🌑","🎪","🩺"];

// ─── THEME (Warm Frost UI + Premium Minimalism) ─────────────────────────────
export const T = {
  // Foundation surfaces
  bg: "#FAF6F1",
  bgCard: "#FFFFFF",
  bgRaised: "#FFF7F0",
  bgInput: "#F5EDE5",
  border: "#E6DCD3",
  borderLight: "#F0E8E0",
  borderFocus: "#D4603A",

  // Text hierarchy (WCAG AA compliant)
  text: "#1A1412",
  textSoft: "#4A3D35",
  textMuted: "#7A6B60",
  textFaint: "#B5A89E",

  // Accent (burnt sienna)
  accent: "#D4603A",
  accentHover: "#C04E2B",
  accentSoft: "#D4603A12",
  accentGlow: "#D4603A25",

  // Semantic colors
  green: "#2D8F62",
  greenSoft: "#2D8F6218",
  red: "#C44040",
  redSoft: "#C4404015",
  amber: "#C17D24",
  amberSoft: "#C17D2415",
  info: "#3A7BBF",
  infoSoft: "#3A7BBF15",

  // Slot identity colors
  coral: "#C85A3A",
  coralSoft: "#C85A3A14",
  gold: "#8B7A2F",
  goldSoft: "#8B7A2F14",
  mint: "#3A7B6E",
  mintSoft: "#3A7B6E14",

  // Semantic aliases
  purple: "#8B5A8B",
  purpleSoft: "#8B5A8B15",

  // Shift indicator colors
  sunGold: "#B8862E",
  nightIndigo: "#4A3B6B",

  // Typography scale
  fontHero: 32,
  fontSection: 16,
  fontCardTitle: 15,
  fontBody: 14,
  fontSmall: 13,
  fontMono: 12,
  fontCaption: 11,

  // Spacing scale (4px base)
  sp4: 4, sp8: 8, sp12: 12, sp16: 16, sp20: 20, sp24: 24, sp32: 32, sp40: 40, sp48: 48, sp64: 64,

  // Border radii
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,

  // Shadows (warm-tinted)
  shadowCard: "0 1px 3px rgba(26,20,18,0.04), 0 4px 12px rgba(26,20,18,0.03)",
  shadowElevated: "0 2px 8px rgba(26,20,18,0.06), 0 8px 24px rgba(26,20,18,0.04)",
  shadowAccent: "0 2px 8px rgba(212,96,58,0.25)",

  // Motion tokens
  dFast: "150ms",
  dNormal: "300ms",
  dSlow: "500ms",
  easeProductive: "cubic-bezier(0.2, 0, 0, 1)",
  easeExpressive: "cubic-bezier(0.4, 0, 0.2, 1)",
};

export const slotColors = { slot1: T.coral, slot2: T.gold, slot3: T.mint };
export const font = `'Outfit', 'Inter', -apple-system, sans-serif`;
export const fontMono = `'JetBrains Mono', 'Fira Code', monospace`;
