// ─── DEFAULT CONFIG ──────────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
  actors: ["Decatur","Sat Charn","Mara","Rumi","Rich","Antonia","Doc","Qurrat","Nicole","Edwin","Chris"],
  actorColors: {
    "Decatur":"#D47B65","Sat Charn":"#6BAA9C","Mara":"#6A9EB5","Rumi":"#D4A054",
    "Rich":"#7CB88A","Antonia":"#D9897E","Doc":"#7BA8C9","Qurrat":"#B48EBF",
    "Nicole":"#7DBDA8","Edwin":"#C48A5C","Chris":"#C48A5C"
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
};

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
export const ALL_WEEKDAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
export const COLOR_PALETTE = ["#D47B65","#6BAA9C","#6A9EB5","#D4A054","#7CB88A","#D9897E","#7BA8C9","#B48EBF","#7DBDA8","#C48A5C","#C27A5A","#A87DB5","#6BAA9C","#C49A6A","#6A94B0","#C9A090","#8FAFC3","#A8D4B8","#E0BAB0","#9BBDD4"];
export const ICON_OPTIONS = ["⚡","🌀","🌧","🛡","🚨","🔄","💙","🧠","🧩","🎭","🔥","💊","🌊","🏥","🫂","🪞","⚠️","🌑","🎪","🩺"];

// ─── THEME (Golden Hour / Sunset) ───────────────────────────────────────────
export const T = {
  bg: "#FFF8F0",
  bgCard: "#FFFFFF",
  bgRaised: "#FFF1E6",
  bgInput: "#FFF5EE",
  border: "#F0D9C6",
  borderLight: "#F5E6D8",
  borderFocus: "#E8917A",
  text: "#3D2B1F",
  textSoft: "#6B5344",
  textMuted: "#9C8578",
  textFaint: "#C4AEA1",
  accent: "#E8917A",
  accentHover: "#D47B65",
  accentSoft: "#E8917A15",
  accentGlow: "#E8917A30",
  mint: "#7DBDA8",
  mintSoft: "#7DBDA815",
  coral: "#E8917A",
  coralSoft: "#E8917A15",
  gold: "#D4A054",
  goldSoft: "#D4A05415",
  green: "#7CB88A",
  greenSoft: "#7CB88A18",
  red: "#D16B6B",
  redSoft: "#D16B6B15",
  amber: "#D4A054",
  amberSoft: "#D4A05415",
  purple: "#B48EBF",
  purpleSoft: "#B48EBF15",
};

export const slotColors = { slot1: T.coral, slot2: T.gold, slot3: T.mint };
export const font = `'Outfit', 'Inter', -apple-system, sans-serif`;
export const fontMono = `'JetBrains Mono', 'Fira Code', monospace`;
