// ─── DEFAULT CONFIG ──────────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
  actors: ["Decatur","Sat Charn","Mara","Rumi","Rich","Antonia","Doc","Qurrat","Nicole","Edwin","Chris"],
  actorColors: {
    "Decatur":"#FF6B6B","Sat Charn":"#4ECDC4","Mara":"#45B7D1","Rumi":"#F7DC6F",
    "Rich":"#82E0AA","Antonia":"#F1948A","Doc":"#85C1E9","Qurrat":"#D7BDE2",
    "Nicole":"#A3E4D7","Edwin":"#F8C471","Chris":"#E59866"
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
export const COLOR_PALETTE = ["#FF6B6B","#4ECDC4","#45B7D1","#F7DC6F","#82E0AA","#F1948A","#85C1E9","#D7BDE2","#A3E4D7","#F8C471","#E59866","#BB8FCE","#76D7C4","#F0B27A","#7FB3D8","#E6B0AA","#A9CCE3","#D5F5E3","#FADBD8","#D4E6F1"];
export const ICON_OPTIONS = ["⚡","🌀","🌧","🛡","🚨","🔄","💙","🧠","🧩","🎭","🔥","💊","🌊","🏥","🫂","🪞","⚠️","🌑","🎪","🩺"];

// ─── THEME ──────────────────────────────────────────────────────────────────
export const T = {
  bg: "#13161C",
  bgCard: "#1A1E27",
  bgRaised: "#222833",
  bgInput: "#181C24",
  border: "#2A303C",
  borderLight: "#323A48",
  borderFocus: "#6C8EEF",
  text: "#EDF0F7",
  textSoft: "#A0AAC0",
  textMuted: "#7B8A9F",
  textFaint: "#464F63",
  accent: "#6C8EEF",
  accentHover: "#5A7AE0",
  accentSoft: "#6C8EEF18",
  accentGlow: "#6C8EEF30",
  mint: "#4ECDC4",
  mintSoft: "#4ECDC415",
  coral: "#FF6B6B",
  coralSoft: "#FF6B6B15",
  gold: "#F7DC6F",
  goldSoft: "#F7DC6F15",
  green: "#82E0AA",
  greenSoft: "#82E0AA18",
  red: "#FF6B6B",
  redSoft: "#FF6B6B15",
  amber: "#F7DC6F",
  amberSoft: "#F7DC6F15",
  purple: "#BB8FCE",
  purpleSoft: "#BB8FCE15",
};

export const slotColors = { slot1: T.coral, slot2: T.accent, slot3: T.mint };
export const font = `'Outfit', 'Inter', -apple-system, sans-serif`;
export const fontMono = `'JetBrains Mono', 'Fira Code', monospace`;
