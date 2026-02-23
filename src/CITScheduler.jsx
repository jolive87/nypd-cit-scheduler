import { useState, useEffect, useCallback, useRef } from "react";
import storage, { exportBackup, importBackup } from "./storage.js";
import { DEFAULT_CONFIG, ALL_WEEKDAYS, COLOR_PALETTE, ICON_OPTIONS, T, slotColors, font, fontMono } from "./config.js";
import { generateSchedule, getActorStats, genShareText, genActorMsg, getDefaultWeekPlan, fmtDate, fmtDateShort, SLOT_KEYS, SHIFTS } from "./scheduler.js";
import { generateICS, downloadICS } from "./ics.js";

// ─── RESPONSIVE HOOK ────────────────────────────────────────────────────────
function useBreakpoint() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 800);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return { isMobile: width < 480, isTablet: width >= 480 && width < 768, isDesktop: width >= 768, isWide: width >= 1024, width };
}

// ─── DATE HELPERS ───────────────────────────────────────────────────────────
function getWeeksInMonth(year, month) {
  const weeks = [];
  const last = new Date(year, month + 1, 0);
  let weekDays = [];
  for (let d = new Date(year, month, 1); d <= last; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 1 && weekDays.length > 0) {
      weeks.push(weekDays);
      weekDays = [];
    }
    if (dow >= 1 && dow <= 5) {
      weekDays.push({
        date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
        dayName: ALL_WEEKDAYS[dow - 1],
        dow
      });
    }
  }
  if (weekDays.length > 0) weeks.push(weekDays);
  return weeks;
}

function getDayAbbr(dayName) { return dayName.slice(0,3); }

// ─── CLIPBOARD HELPER ──────────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: textarea method
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// ─── UI BUILDING BLOCKS ────────────────────────────────────────────────────
const btnBase = { fontFamily: font, border: "none", cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "0.01em" };

function Btn({ children, variant = "primary", onClick, style, disabled, "aria-label": ariaLabel }) {
  const v = {
    primary: { background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accentHover} 100%)`, color: "#fff", fontWeight: "700", boxShadow: `0 0 20px ${T.accentGlow}, 0 2px 4px rgba(180,140,110,0.15)`, padding: "11px 22px", borderRadius: "12px", fontSize: "13.5px" },
    secondary: { background: T.bgRaised, color: T.textSoft, fontWeight: "600", boxShadow: "0 1px 3px rgba(180,140,110,0.08)", border: `1px solid ${T.border}`, padding: "10px 18px", borderRadius: "11px", fontSize: "13px" },
    ghost: { background: "transparent", color: T.textMuted, fontWeight: "500", padding: "8px 14px", borderRadius: "10px", fontSize: "13px" },
    danger: { background: T.redSoft, color: T.red, fontWeight: "600", padding: "7px 14px", borderRadius: "9px", fontSize: "12px", border: `1px solid ${T.red}30` },
    small: { background: T.bgRaised, color: T.textMuted, fontWeight: "600", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", border: `1px solid ${T.border}` },
    mint: { background: `linear-gradient(135deg, ${T.mint}, ${T.mint}DD)`, color: "#fff", fontWeight: "700", boxShadow: `0 0 16px ${T.mint}30`, padding: "11px 22px", borderRadius: "12px", fontSize: "13.5px" },
  };
  return <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={{ ...btnBase, ...v[variant], opacity: disabled ? 0.4 : 1, minHeight: "44px", ...style }}>{children}</button>;
}

function Card({ children, style, glow, accent }) {
  return <div style={{ background: T.bgCard, borderRadius: "16px", padding: "20px", border: `1px solid ${accent ? `${accent}25` : T.border}`, boxShadow: glow ? `0 0 24px ${glow}10, 0 2px 8px rgba(180,140,110,0.10)` : "0 2px 8px rgba(180,140,110,0.08)", transition: "all 0.2s", ...style }}>{children}</div>;
}

function Badge({ type = "neutral", children }) {
  const m = { success: { bg: T.greenSoft, c: T.green, b: `${T.green}30` }, warning: { bg: T.amberSoft, c: T.amber, b: `${T.amber}30` }, error: { bg: T.redSoft, c: T.red, b: `${T.red}30` }, info: { bg: T.accentSoft, c: T.accent, b: `${T.accent}30` }, neutral: { bg: `${T.textFaint}20`, c: T.textMuted, b: T.border }, accent: { bg: T.accentSoft, c: T.accent, b: `${T.accent}30` } };
  const { bg, c, b } = m[type] || m.neutral;
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "700", fontFamily: font, background: bg, color: c, border: `1px solid ${b}`, letterSpacing: "0.03em" }}>{children}</span>;
}

function Chip({ children, active, color, onClick, dimmed, small }) {
  const cl = color || T.accent;
  return <button onClick={onClick} style={{ ...btnBase, display: "inline-flex", alignItems: "center", gap: "6px", padding: small ? "6px 12px" : "10px 16px", borderRadius: small ? "8px" : "11px", border: active ? `2px solid ${cl}` : `1.5px solid ${T.border}`, background: active ? `${cl}15` : "transparent", fontSize: small ? "12px" : "13px", fontWeight: active ? "700" : "400", color: active ? cl : (dimmed ? T.textFaint : T.textMuted), opacity: dimmed && !active ? 0.4 : 1, minHeight: small ? "36px" : "44px" }}>
    {active && <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: cl, boxShadow: `0 0 8px ${cl}60` }} />}
    {children}
  </button>;
}

function Input({ value, onChange, placeholder, style }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ fontFamily: font, fontSize: "14px", padding: "10px 14px", borderRadius: "10px", border: `1.5px solid ${T.border}`, background: T.bgInput, color: T.text, outline: "none", width: "100%", transition: "border 0.2s", minHeight: "44px", ...style }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />;
}

function StyledSelect({ value, onChange, children, style }) {
  return <select value={value} onChange={onChange} style={{ fontFamily: font, fontSize: "13px", fontWeight: "600", padding: "8px 30px 8px 12px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.bgInput, color: T.text, cursor: "pointer", minHeight: "44px", appearance: "none", WebkitAppearance: "none", colorScheme: "light", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239C8578' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", ...style }}>{children}</select>;
}

function SectionHead({ icon, title, sub, right }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}><div><h2 style={{ fontFamily: font, fontSize: "18px", fontWeight: "800", color: T.text, margin: 0, letterSpacing: "-0.02em" }}>{icon && <span style={{ marginRight: "8px" }}>{icon}</span>}{title}</h2>{sub && <p style={{ fontSize: "13px", color: T.textMuted, margin: "3px 0 0" }}>{sub}</p>}</div>{right}</div>;
}

function StatBox({ value, label, color }) {
  return <div style={{ textAlign: "center", flex: 1, minWidth: "70px" }}><div style={{ fontFamily: fontMono, fontSize: "24px", fontWeight: "700", color: color || T.accent, lineHeight: 1.1, textShadow: `0 0 20px ${color || T.accent}30` }}>{value}</div><div style={{ fontSize: "10px", color: T.textMuted, fontWeight: "700", marginTop: "5px", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div></div>;
}

function SlotBar({ slotKey }) { return <div style={{ width: "4px", height: "28px", borderRadius: "2px", background: slotColors[slotKey] || T.accent, boxShadow: `0 0 8px ${slotColors[slotKey] || T.accent}40`, flexShrink: 0 }} />; }

// ─── MODALS ────────────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  const mobile = window.innerWidth < 480;
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(80,50,30,0.35)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? "0" : "16px", backdropFilter: "blur(8px)" }}><div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: mobile ? "100%" : "540px", maxHeight: mobile ? "95vh" : "92vh", overflowY: "auto", borderRadius: mobile ? "18px 18px 0 0" : undefined }}>{children}</div></div>;
}

function WelcomeModal({ onClose }) {
  const steps = [{ n: "1", t: "Plan Your Weeks", d: "Set which days training runs. Shift forward/back for weather delays." }, { n: "2", t: "Set Availability", d: "Toggle who's available each training day." }, { n: "3", t: "Generate", d: "One tap — actors get assigned following all the rules." }, { n: "4", t: "Share & Export", d: "Google Calendar, text actors, or copy the full schedule." }];
  return <Overlay onClose={onClose}><Card style={{ padding: "32px", textAlign: "center" }}><div style={{ fontSize: "48px", marginBottom: "8px" }}>🎭</div><h1 style={{ fontFamily: font, fontSize: "22px", fontWeight: "800", color: T.text, margin: "0 0 4px", letterSpacing: "-0.02em" }}>CIT Actor Scheduler</h1><p style={{ fontSize: "14px", color: T.textMuted, margin: "0 0 24px" }}>Four steps. That's it.</p><div style={{ textAlign: "left" }}>{steps.map((s, i) => <div key={i} style={{ display: "flex", gap: "14px", marginBottom: "16px", alignItems: "flex-start" }}><div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `linear-gradient(135deg, ${T.accent}, ${T.accentHover})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "14px", flexShrink: 0, boxShadow: `0 0 12px ${T.accentGlow}` }}>{s.n}</div><div><div style={{ fontWeight: "700", color: T.text, fontSize: "14px" }}>{s.t}</div><div style={{ color: T.textSoft, fontSize: "13px", lineHeight: 1.4 }}>{s.d}</div></div></div>)}</div><Btn onClick={onClose} style={{ width: "100%", marginTop: "8px", padding: "14px", fontSize: "15px" }}>Let's go →</Btn></Card></Overlay>;
}

function ShareModal({ weeks, weekPlans, schedule, monthName, year, config, onClose, showToast }) {
  const [type, setType] = useState("full");
  const [actor, setActor] = useState(config.actors[0]);
  const [copied, setCopied] = useState(false);
  const text = type === "full" ? genShareText(weeks, weekPlans, schedule, monthName, year, config) : genActorMsg(actor, weeks, weekPlans, schedule, monthName, year, config);
  const copy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else { showToast("Copy failed — try selecting the text manually", "error"); }
  };
  return <Overlay onClose={onClose}><Card style={{ padding: "28px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}><h2 style={{ fontFamily: font, fontSize: "18px", fontWeight: "800", margin: 0, color: T.text }}>📤 Share Schedule</h2><button onClick={onClose} aria-label="Close" style={{ ...btnBase, background: "none", fontSize: "20px", color: T.textMuted, minHeight: "44px", minWidth: "44px" }}>✕</button></div><div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}><Btn variant={type === "full" ? "primary" : "secondary"} onClick={() => setType("full")}>📋 Full</Btn><Btn variant={type === "actor" ? "primary" : "secondary"} onClick={() => setType("actor")}>👤 Individual</Btn></div>{type === "actor" && <div style={{ marginBottom: "12px" }}><div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>{config.actors.map(a => <Chip key={a} active={actor === a} color={config.actorColors[a]} onClick={() => setActor(a)} small>{a}</Chip>)}</div></div>}<div style={{ fontFamily: fontMono, fontSize: "11.5px", lineHeight: 1.6, background: T.bg, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "16px", whiteSpace: "pre-wrap", maxHeight: "260px", overflowY: "auto", color: T.textSoft }}>{text}</div><Btn onClick={copy} style={{ width: "100%", marginTop: "12px", padding: "14px" }} variant={copied ? "mint" : "primary"}>{copied ? "✓ Copied!" : "📋 Copy to Clipboard"}</Btn></Card></Overlay>;
}

// ─── WEEK PLANNER ──────────────────────────────────────────────────────────
function WeekPlanner({ weekIndex, weekDays, plan, config, onChange, isMobile }) {
  const defaultPlan = getDefaultWeekPlan(weekDays, config);
  const currentPlan = plan || defaultPlan;
  const allCanceled = SLOT_KEYS.every(sk => !currentPlan[sk]);
  const [collapsed, setCollapsed] = useState(false);

  const shiftForward = () => {
    const newPlan = {};
    SLOT_KEYS.forEach(sk => {
      const currentDate = currentPlan[sk];
      if (!currentDate) return;
      const idx = weekDays.findIndex(w => w.date === currentDate);
      if (idx >= 0 && idx < weekDays.length - 1) newPlan[sk] = weekDays[idx + 1].date;
      else if (idx === weekDays.length - 1) newPlan[sk] = null;
      else newPlan[sk] = currentDate;
    });
    onChange(newPlan);
  };

  const shiftBack = () => {
    const newPlan = {};
    SLOT_KEYS.forEach(sk => {
      const currentDate = currentPlan[sk];
      if (!currentDate) return;
      const idx = weekDays.findIndex(w => w.date === currentDate);
      if (idx > 0) newPlan[sk] = weekDays[idx - 1].date;
      else newPlan[sk] = currentDate;
    });
    onChange(newPlan);
  };

  const resetDefault = () => onChange(defaultPlan);
  const cancelWeek = () => onChange({ slot1: null, slot2: null, slot3: null });

  const assignSlotToDate = (slotKey, dateStr) => {
    const newPlan = { ...currentPlan };
    if (dateStr === "") { newPlan[slotKey] = null; }
    else {
      Object.keys(newPlan).forEach(sk => { if (newPlan[sk] === dateStr && sk !== slotKey) newPlan[sk] = null; });
      newPlan[slotKey] = dateStr;
    }
    onChange(newPlan);
  };

  const startFrom = (startDate) => {
    const startIdx = weekDays.findIndex(w => w.date === startDate);
    onChange({
      slot1: weekDays[startIdx]?.date || null,
      slot2: weekDays[startIdx + 1]?.date || null,
      slot3: weekDays[startIdx + 2]?.date || null,
    });
  };

  return (
    <Card style={{ marginBottom: "12px", padding: "16px" }} accent={allCanceled ? T.red : null}>
      {/* Header */}
      <div
        onClick={isMobile ? () => setCollapsed(c => !c) : undefined}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : "12px", flexWrap: "wrap", gap: "8px", cursor: isMobile ? "pointer" : "default" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: fontMono, fontSize: "11px", fontWeight: "700", color: T.textMuted, background: T.bgRaised, padding: "3px 8px", borderRadius: "6px", border: `1px solid ${T.border}` }}>WK{weekIndex + 1}</span>
          <span style={{ fontSize: "13px", color: T.textSoft }}>
            {weekDays.length > 0 && `${fmtDate(weekDays[0].date)} – ${fmtDate(weekDays[weekDays.length - 1].date)}`}
          </span>
          {allCanceled && <Badge type="error">CANCELED</Badge>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {!allCanceled && !collapsed && <span style={{ fontSize: "11px", color: T.textFaint }}>
            {SLOT_KEYS.filter(sk => currentPlan[sk]).map(sk => {
              const d = weekDays.find(w => w.date === currentPlan[sk]);
              return d ? getDayAbbr(d.dayName) : null;
            }).filter(Boolean).join(" → ")}
          </span>}
          {isMobile && <span style={{ fontSize: "14px", color: T.textMuted, marginLeft: "4px" }}>{collapsed ? "▼" : "▲"}</span>}
        </div>
      </div>

      {!collapsed && <>
        {/* "Start from" quick-pick row */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            Start training from:
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {weekDays.map(wd => {
              const isCurrentStart = currentPlan.slot1 === wd.date;
              return (
                <button
                  key={wd.date}
                  onClick={() => startFrom(wd.date)}
                  style={{
                    ...btnBase,
                    flex: "1 1 0",
                    minWidth: "48px",
                    minHeight: "40px",
                    padding: "8px 4px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: isCurrentStart ? "800" : "600",
                    background: isCurrentStart
                      ? `linear-gradient(135deg, ${T.accent}, ${T.accentHover})`
                      : T.bgRaised,
                    color: isCurrentStart ? "#fff" : T.textSoft,
                    border: isCurrentStart
                      ? `2px solid ${T.accent}`
                      : `1.5px solid ${T.border}`,
                    boxShadow: isCurrentStart
                      ? `0 0 12px ${T.accentGlow}`
                      : "none",
                  }}
                >
                  {getDayAbbr(wd.dayName)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot cards with day pills */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
          {SLOT_KEYS.map(sk => {
            const scenarios = config.slotScenarios[sk] || [];
            const color = slotColors[sk];
            const assigned = currentPlan[sk];
            const dayInfo = assigned ? weekDays.find(w => w.date === assigned) : null;
            return (
              <div key={sk} style={{ flex: "1 1 0", minWidth: isMobile ? "auto" : "140px", padding: "10px 12px", borderRadius: "12px", border: `1.5px solid ${assigned ? `${color}35` : T.border}`, background: assigned ? `${color}08` : T.bgRaised }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  {config.slotNames[sk]}
                </div>
                {/* Day pill or Off state */}
                {assigned && dayInfo ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "10px", background: `${color}12`, border: `1.5px solid ${color}30`, marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: color }}>{getDayAbbr(dayInfo.dayName)} {fmtDate(assigned)}</span>
                    <button onClick={() => assignSlotToDate(sk, "")} aria-label={`Cancel ${config.slotNames[sk]}`} style={{ ...btnBase, background: "none", fontSize: "14px", color: T.textMuted, padding: "2px 6px", minHeight: "28px", minWidth: "28px", borderRadius: "6px" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ padding: "8px 12px", borderRadius: "10px", background: T.redSoft, border: `1px solid ${T.red}20`, fontSize: "13px", fontWeight: "600", color: T.red, textAlign: "center", marginBottom: "6px" }}>Off</div>
                )}
                {/* Secondary dropdown for manual override */}
                <StyledSelect value={assigned || ""} onChange={e => assignSlotToDate(sk, e.target.value)} style={{ width: "100%", fontSize: "11px", minHeight: "36px", padding: "6px 28px 6px 10px" }}>
                  <option value="">— Off —</option>
                  {weekDays.map(wd => <option key={wd.date} value={wd.date}>{getDayAbbr(wd.dayName)} {fmtDate(wd.date)}</option>)}
                </StyledSelect>
                <div style={{ fontSize: "10px", color: T.textFaint, marginTop: "4px" }}>{scenarios.map(s => `${config.scenarioIcons[s] || ""} ${s}`).join(", ")}</div>
              </div>
            );
          })}
        </div>

        {/* Secondary controls */}
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "10px", justifyContent: "center" }}>
          <Btn variant="small" onClick={shiftBack} style={{ padding: "5px 10px", fontSize: "12px", minHeight: "36px", minWidth: "44px" }} aria-label="Shift week back">◀ Shift</Btn>
          <Btn variant="small" onClick={shiftForward} style={{ padding: "5px 10px", fontSize: "12px", minHeight: "36px", minWidth: "44px" }} aria-label="Shift week forward">Shift ▶</Btn>
          <Btn variant="small" onClick={resetDefault} style={{ minHeight: "36px", fontSize: "12px" }}>Reset</Btn>
          <Btn variant="small" onClick={cancelWeek} style={{ color: T.red, borderColor: `${T.red}30`, minHeight: "36px", fontSize: "12px" }}>Cancel Week</Btn>
        </div>
      </>}
    </Card>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────────────────────
function SettingsPanel({ config, onSave, onClose, showToast }) {
  const [cfg, setCfg] = useState(JSON.parse(JSON.stringify(config)));
  const [tab, setTab] = useState("actors");
  const [newActor, setNewActor] = useState("");
  const [newScenario, setNewScenario] = useState("");
  const [editIcon, setEditIcon] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [changed, setChanged] = useState(false);
  const [importConfirm, setImportConfirm] = useState(false);
  const fileInputRef = useRef(null);
  const u = fn => { setCfg(p => { const n = JSON.parse(JSON.stringify(p)); fn(n); return n }); setChanged(true) };
  const allSc = Object.keys(cfg.scenarioActors);

  const addActor = () => { const n = newActor.trim(); if (!n || cfg.actors.includes(n)) return; u(c => { c.actors.push(n); const used = Object.values(c.actorColors); c.actorColors[n] = COLOR_PALETTE.find(x => !used.includes(x)) || COLOR_PALETTE[c.actors.length % COLOR_PALETTE.length] }); setNewActor("") };
  const rmActor = a => { u(c => { c.actors = c.actors.filter(x => x !== a); delete c.actorColors[a]; Object.keys(c.scenarioActors).forEach(sc => { c.scenarioActors[sc] = c.scenarioActors[sc].filter(x => x !== a) }) }); setConfirmDel(null) };
  const toggleAS = (sc, a) => { u(c => { const l = c.scenarioActors[sc] || []; if (l.includes(a)) c.scenarioActors[sc] = l.filter(x => x !== a); else c.scenarioActors[sc] = [...l, a] }) };
  const addSc = () => { const n = newScenario.trim(); if (!n || cfg.scenarioActors[n]) return; u(c => { c.scenarioActors[n] = []; c.scenarioIcons[n] = "🎭" }); setNewScenario("") };
  const rmSc = sc => { u(c => { delete c.scenarioActors[sc]; delete c.scenarioIcons[sc]; SLOT_KEYS.forEach(sk => { if (c.slotScenarios[sk]) c.slotScenarios[sk] = c.slotScenarios[sk].filter(s => s !== sc) }) }); setConfirmDel(null) };
  const toggleSlotSc = (sk, sc) => { u(c => { const l = c.slotScenarios[sk] || []; if (l.includes(sc)) c.slotScenarios[sk] = l.filter(s => s !== sc); else c.slotScenarios[sk] = [...l, sc] }) };

  const handleExport = async () => {
    await exportBackup();
    showToast("Backup downloaded", "success");
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await importBackup(file);
      showToast(`Restored ${count} items — reload to see changes`, "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast(err.message, "error");
    }
    e.target.value = '';
  };

  const tabs = [{ key: "actors", icon: "👤", label: "Actors" }, { key: "scenarios", icon: "🎭", label: "Scenarios" }, { key: "days", icon: "📅", label: "Day Setup" }, { key: "rules", icon: "⚠️", label: "Rules" }, { key: "data", icon: "💾", label: "Data" }];

  return <Overlay onClose={onClose}><Card style={{ padding: 0, borderRadius: "18px" }}>
    <div style={{ padding: "24px 24px 16px", borderBottom: `1px solid ${T.border}`, background: T.bgRaised, borderRadius: "18px 18px 0 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}><h2 style={{ fontFamily: font, fontSize: "20px", fontWeight: "800", margin: 0, color: T.text, letterSpacing: "-0.02em" }}>⚙️ Settings</h2><button onClick={onClose} aria-label="Close settings" style={{ ...btnBase, background: "none", fontSize: "22px", color: T.textMuted, minHeight: "44px", minWidth: "44px" }}>✕</button></div>
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>{tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{ ...btnBase, padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", background: tab === t.key ? `linear-gradient(135deg,${T.accent},${T.accentHover})` : "transparent", color: tab === t.key ? "#fff" : T.textMuted, boxShadow: tab === t.key ? `0 0 12px ${T.accentGlow}` : "none", whiteSpace: "nowrap", letterSpacing: "0.02em", minHeight: "40px" }}>{t.icon} {t.label}</button>)}</div>
    </div>
    <div style={{ padding: "20px 24px 24px", maxHeight: "55vh", overflowY: "auto" }}>
      {tab === "actors" && <div><p style={{ fontSize: "13px", color: T.textSoft, margin: "0 0 14px" }}>Add or remove actors. Removing clears them from all scenarios.</p><div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}><Input value={newActor} onChange={setNewActor} placeholder="New actor name..." style={{ flex: 1 }} /><Btn onClick={addActor}>+ Add</Btn></div>{cfg.actors.map(a => { const cl = cfg.actorColors[a]; const sc = allSc.filter(s => (cfg.scenarioActors[s] || []).includes(a)).length; return <div key={a} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "12px", border: `1px solid ${T.border}`, background: T.bgRaised, marginBottom: "6px" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${cl}20`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px", color: cl }}>{a[0]}</div><div><div style={{ fontWeight: "600", color: T.text, fontSize: "14px" }}>{a}</div><div style={{ fontSize: "11px", color: T.textMuted }}>{sc} scenario{sc !== 1 ? "s" : ""}</div></div></div><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "24px", height: "24px", borderRadius: "6px", background: cl, border: `1px solid ${T.border}` }} />{confirmDel === a ? <div style={{ display: "flex", gap: "4px" }}><Btn variant="danger" onClick={() => rmActor(a)}>Yes</Btn><Btn variant="small" onClick={() => setConfirmDel(null)}>No</Btn></div> : <Btn variant="ghost" onClick={() => setConfirmDel(a)} style={{ color: T.red, padding: "4px 8px", minHeight: "36px" }}>×</Btn>}</div></div> })}</div>}

      {tab === "scenarios" && <div><p style={{ fontSize: "13px", color: T.textSoft, margin: "0 0 14px" }}>Tap actors to approve/remove them for each scenario.</p><div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}><Input value={newScenario} onChange={setNewScenario} placeholder="New scenario..." style={{ flex: 1 }} /><Btn onClick={addSc}>+ Add</Btn></div>{allSc.map(sc => { const actors = cfg.scenarioActors[sc] || []; const icon = cfg.scenarioIcons[sc] || "🎭"; return <Card key={sc} style={{ marginBottom: "10px", padding: "14px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{editIcon === sc ? <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", maxWidth: "200px" }}>{ICON_OPTIONS.map(ic => <button key={ic} onClick={() => { u(c => { c.scenarioIcons[sc] = ic }); setEditIcon(null) }} style={{ ...btnBase, fontSize: "16px", padding: "4px 6px", borderRadius: "6px", background: ic === icon ? T.accentSoft : "transparent", border: `1px solid ${ic === icon ? T.accent : T.border}`, minHeight: "36px", minWidth: "36px" }}>{ic}</button>)}</div> : <button onClick={() => setEditIcon(sc)} style={{ ...btnBase, fontSize: "18px", background: "none", padding: "2px", minHeight: "36px" }}>{icon}</button>}<span style={{ fontWeight: "700", fontSize: "15px", color: T.text }}>{sc}</span><Badge type="neutral">{actors.length}</Badge></div>{confirmDel === `sc-${sc}` ? <div style={{ display: "flex", gap: "4px" }}><Btn variant="danger" onClick={() => rmSc(sc)}>Remove</Btn><Btn variant="small" onClick={() => setConfirmDel(null)}>Cancel</Btn></div> : <Btn variant="ghost" onClick={() => setConfirmDel(`sc-${sc}`)} style={{ color: T.red }}>×</Btn>}</div><div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>{cfg.actors.map(a => <Chip key={a} active={actors.includes(a)} color={cfg.actorColors[a]} onClick={() => toggleAS(sc, a)} small>{a}</Chip>)}</div></Card> })}</div>}

      {tab === "days" && <div><p style={{ fontSize: "13px", color: T.textSoft, margin: "0 0 14px" }}>Assign scenarios to each training slot.</p>{SLOT_KEYS.map(sk => { const assigned = cfg.slotScenarios[sk] || []; const cl = slotColors[sk]; return <Card key={sk} style={{ marginBottom: "10px" }} accent={cl}><div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}><SlotBar slotKey={sk} /><span style={{ fontWeight: "700", fontSize: "16px", color: T.text }}>{cfg.slotNames[sk]}</span><Badge type="info">Default: {cfg.defaultDays[sk]}</Badge></div><div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{allSc.map(sc => { const active = assigned.includes(sc); const otherSlot = SLOT_KEYS.find(s => s !== sk && (cfg.slotScenarios[s] || []).includes(sc)); return <Chip key={sc} active={active} color={cl} onClick={() => toggleSlotSc(sk, sc)} dimmed={!!otherSlot && !active}>{cfg.scenarioIcons[sc] || "🎭"} {sc}{otherSlot && !active ? ` (${cfg.slotNames[otherSlot]})` : ""}</Chip> })}</div></Card> })}</div>}

      {tab === "rules" && <div><p style={{ fontSize: "13px", color: T.textSoft, margin: "0 0 14px" }}>Same actor can't play both scenarios in the same shift.</p>{(cfg.conflicts || []).map((rule, i) => <Card key={i} style={{ marginBottom: "8px", padding: "14px" }}><div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}><span style={{ fontSize: "13px", fontWeight: "600", color: T.text }}>Can't play</span><StyledSelect value={rule.actor_cannot_play[0]} onChange={e => { u(c => { c.conflicts[i].actor_cannot_play[0] = e.target.value }) }}><option value="">—</option>{allSc.map(s => <option key={s}>{s}</option>)}</StyledSelect><span style={{ color: T.textMuted }}>+</span><StyledSelect value={rule.actor_cannot_play[1]} onChange={e => { u(c => { c.conflicts[i].actor_cannot_play[1] = e.target.value }) }}><option value="">—</option>{allSc.map(s => <option key={s}>{s}</option>)}</StyledSelect><Btn variant="ghost" onClick={() => { u(c => { c.conflicts.splice(i, 1) }) }} style={{ color: T.red }}>×</Btn></div></Card>)}<Btn variant="secondary" onClick={() => { u(c => { c.conflicts = [...(c.conflicts || []), { actor_cannot_play: ["", ""], scope: "same_shift" }] }) }}>+ Add Rule</Btn></div>}

      {tab === "data" && <div>
        <p style={{ fontSize: "13px", color: T.textSoft, margin: "0 0 14px" }}>Export your data as a backup file. Import to restore on another device.</p>
        <Card style={{ marginBottom: "12px", padding: "16px" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", color: T.text, marginBottom: "8px" }}>📤 Export Backup</div>
          <p style={{ fontSize: "12px", color: T.textMuted, margin: "0 0 12px" }}>Downloads all your settings and schedules as a JSON file.</p>
          <Btn variant="secondary" onClick={handleExport}>Download Backup</Btn>
        </Card>
        <Card style={{ padding: "16px" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", color: T.text, marginBottom: "8px" }}>📥 Import Backup</div>
          <p style={{ fontSize: "12px", color: T.textMuted, margin: "0 0 12px" }}>Restore from a backup file. This will overwrite existing data and reload the page.</p>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          {importConfirm ? <div style={{ display: "flex", gap: "8px" }}><Btn variant="danger" onClick={() => { fileInputRef.current?.click(); setImportConfirm(false) }}>Choose File</Btn><Btn variant="small" onClick={() => setImportConfirm(false)}>Cancel</Btn></div> : <Btn variant="secondary" onClick={() => setImportConfirm(true)}>Import Backup</Btn>}
        </Card>
      </div>}
    </div>
    <div style={{ padding: "16px 24px", borderTop: `1px solid ${T.border}`, background: T.bgRaised, borderRadius: "0 0 18px 18px", display: "flex", gap: "10px", justifyContent: "flex-end" }}><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={() => { onSave(cfg); setChanged(false) }} disabled={!changed}>{changed ? "💾 Save" : "✓ Saved"}</Btn></div>
  </Card></Overlay>;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
export default function CITScheduler() {
  const bp = useBreakpoint();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() === 11 ? 0 : now.getMonth() + 1);
  const [year, setYear] = useState(now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear());
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [availability, setAvailability] = useState({});
  const [weekPlans, setWeekPlans] = useState({});
  const [schedule, setSchedule] = useState(null);
  const [errors, setErrors] = useState([]);
  const [view, setView] = useState("plan");
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const weeks = getWeeksInMonth(year, month);
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
  // 1-based month for storage key
  const sKey = `cit-v4-${year}-${String(month + 1).padStart(2, '0')}`;

  const showT = (msg, type = "info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500) };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await storage.get("cit-v4-welcomed");
        if (!s) { setShowWelcome(true); await storage.set("cit-v4-welcomed", "1") }
      } catch { setShowWelcome(true) }
      try {
        const c = await storage.get("cit-v4-config");
        if (c?.value) setConfig(JSON.parse(c.value));
      } catch {}
      try {
        const r = await storage.get(sKey);
        if (r?.value) {
          const d = JSON.parse(r.value);
          setAvailability(d.availability || {});
          setWeekPlans(d.weekPlans || {});
          setSchedule(d.schedule || null);
          setErrors(d.errors || []);
          setOverrides(d.overrides || {});
        } else {
          setAvailability({}); setWeekPlans({}); setSchedule(null); setErrors([]); setOverrides({});
        }
      } catch { setAvailability({}); setWeekPlans({}); setSchedule(null); setErrors([]); setOverrides({}) }
      setLoading(false);
    })()
  }, [sKey]);

  const save = useCallback(async (a, wp, s, e, o) => {
    try { await storage.set(sKey, JSON.stringify({ availability: a, weekPlans: wp, schedule: s, errors: e, overrides: o })) }
    catch (err) { console.error(err) }
  }, [sKey]);

  const saveConfig = async cfg => {
    setConfig(cfg);
    try { await storage.set("cit-v4-config", JSON.stringify(cfg)) } catch {}
    showT("Settings saved ✓", "success");
    setShowSettings(false);
  };

  const toggleActor = (ds, actor) => {
    setAvailability(p => { const n = { ...p, [ds]: { ...p[ds], [actor]: !p[ds]?.[actor] } }; save(n, weekPlans, schedule, errors, overrides); return n });
  };
  const setAllAvail = ds => {
    setAvailability(p => { const n = { ...p, [ds]: {} }; config.actors.forEach(a => n[ds][a] = true); save(n, weekPlans, schedule, errors, overrides); return n });
  };
  const clearDay = ds => {
    setAvailability(p => { const n = { ...p, [ds]: {} }; save(n, weekPlans, schedule, errors, overrides); return n });
  };

  const copyFromLastMonth = async () => {
    // Calculate previous month key
    let pm = month - 1, py = year;
    if (pm < 0) { pm = 11; py-- }
    const prevKey = `cit-v4-${py}-${String(pm + 1).padStart(2, '0')}`;
    try {
      const r = await storage.get(prevKey);
      if (!r?.value) { showT("No data from last month", "warning"); return; }
      const d = JSON.parse(r.value);
      const prevAvail = d.availability || {};
      if (Object.keys(prevAvail).length === 0) { showT("No availability data last month", "warning"); return; }
      // Copy availability patterns: match by day-of-week
      const prevByDow = {};
      Object.entries(prevAvail).forEach(([dateStr, actors]) => {
        const [y, m, day] = dateStr.split('-').map(Number);
        const dow = new Date(y, m - 1, day).getDay();
        if (!prevByDow[dow]) prevByDow[dow] = actors;
      });
      const newAvail = { ...availability };
      const activeDates = [];
      weeks.forEach((wd, wi) => {
        const plan = weekPlans[`week${wi}`] || getDefaultWeekPlan(wd, config);
        SLOT_KEYS.forEach(sk => { if (plan[sk]) activeDates.push(plan[sk]) });
      });
      activeDates.forEach(ds => {
        const [y, m, day] = ds.split('-').map(Number);
        const dow = new Date(y, m - 1, day).getDay();
        if (prevByDow[dow]) newAvail[ds] = { ...prevByDow[dow] };
      });
      setAvailability(newAvail);
      save(newAvail, weekPlans, schedule, errors, overrides);
      showT("Copied from last month ✓", "success");
    } catch {
      showT("Could not load last month", "error");
    }
  };

  const updateWeekPlan = (wi, plan) => {
    setWeekPlans(p => { const n = { ...p, [`week${wi}`]: plan }; save(availability, n, schedule, errors, overrides); return n });
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const { schedule: s, errors: e } = generateSchedule(weeks, weekPlans, availability, config);
      setSchedule(s); setErrors(e); setView("schedule");
      save(availability, weekPlans, s, e, overrides);
      setGenerating(false);
      if (!e.length) showT("All slots filled", "success");
      else showT(`${e.length} gap${e.length > 1 ? "s" : ""}—check schedule`, "warning");
    }, 150);
  };

  const handleOverride = (wk, sk, shift, sc, actor) => {
    const key = `${wk}|${sk}|${shift}|${sc}`;
    setOverrides(p => {
      const n = { ...p, [key]: actor };
      if (schedule) {
        const ns = JSON.parse(JSON.stringify(schedule));
        if (ns[wk]?.[sk]?.[shift]) ns[wk][sk][shift][sc] = actor || null;
        setSchedule(ns); save(availability, weekPlans, ns, errors, n);
      }
      return n;
    });
  };

  const exportICSFile = () => {
    if (!schedule) return;
    setExporting(true);
    setTimeout(() => {
      const ics = generateICS(weeks, weekPlans, schedule, year, month, config);
      downloadICS(ics, monthName, year);
      setExporting(false);
      showT("Calendar downloaded", "success");
    }, 150);
  };

  const chgMonth = d => {
    let m = month + d, y = year;
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m); setYear(y);
  };

  if (loading) return <div style={{ fontFamily: font, background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: "40px", marginBottom: "12px" }}>🎭</div><p style={{ color: T.textMuted, fontSize: "13px", fontWeight: "600", letterSpacing: "0.5px" }}>LOADING</p></div></div>;

  const activeDates = [];
  weeks.forEach((wd, wi) => { const plan = weekPlans[`week${wi}`] || getDefaultWeekPlan(wd, config); SLOT_KEYS.forEach(sk => { if (plan[sk]) activeDates.push(plan[sk]) }) });
  const totalSlots = activeDates.length * 2;
  const filledSlots = schedule ? Object.values(schedule).reduce((s, wk) => s + SLOT_KEYS.reduce((s2, sk) => s2 + (wk[sk] ? SHIFTS.reduce((s3, sh) => s3 + Object.values(wk[sk][sh] || {}).filter(Boolean).length, 0) : 0), 0), 0) : 0;
  const actorStats = getActorStats(weeks, weekPlans, schedule, config);

  const navItems = [{ key: "plan", icon: "🗓", label: "Plan" }, { key: "availability", icon: "📋", label: "Actors" }, { key: "schedule", icon: "📅", label: "Schedule" }, { key: "dashboard", icon: "📊", label: "Stats" }, { key: "reference", icon: "📖", label: "Guide" }];

  return (
    <div style={{ fontFamily: font, background: T.bg, minHeight: "100vh", paddingBottom: "100px", color: T.text }}>
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      {showShare && schedule && <ShareModal weeks={weeks} weekPlans={weekPlans} schedule={schedule} monthName={monthName} year={year} config={config} onClose={() => setShowShare(false)} showToast={showT} />}
      {showSettings && <SettingsPanel config={config} onSave={saveConfig} onClose={() => setShowSettings(false)} showToast={showT} />}
      {toast && <div style={{ position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 999, padding: "10px 22px", borderRadius: "12px", fontFamily: font, fontSize: "13px", fontWeight: "700", background: toast.type === "success" ? T.green : toast.type === "warning" ? T.amber : toast.type === "error" ? T.red : T.accent, color: "#fff", boxShadow: `0 0 20px ${(toast.type === "success" ? T.green : T.accent)}40`, animation: "slideDown .3s ease", letterSpacing: "0.02em" }}>{toast.msg}</div>}

      {/* HEADER */}
      <div style={{ background: `linear-gradient(180deg, ${T.bgRaised} 0%, ${T.bg} 100%)`, borderBottom: `1px solid ${T.border}`, padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <button onClick={() => setShowWelcome(true)} aria-label="Help" style={{ ...btnBase, background: "none", fontSize: "12px", padding: "6px 10px", color: T.textMuted, minHeight: "44px", minWidth: "44px" }}>❓</button>
          <div style={{ fontFamily: fontMono, fontSize: "10px", fontWeight: "700", color: T.accent, textTransform: "uppercase", letterSpacing: "3px" }}>CIT SCHEDULER</div>
          <button onClick={() => setShowSettings(true)} aria-label="Settings" style={{ ...btnBase, background: "none", fontSize: "15px", padding: "6px 10px", color: T.textMuted, minHeight: "44px", minWidth: "44px" }}>⚙️</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", marginBottom: "12px" }}>
          <button onClick={() => chgMonth(-1)} aria-label="Previous month" style={{ ...btnBase, background: "none", fontSize: "22px", color: T.textMuted, padding: "4px 10px", minHeight: "44px", minWidth: "44px" }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: font, fontSize: "28px", fontWeight: "800", color: T.text, letterSpacing: "-0.03em", lineHeight: 1 }}>{monthName}</div>
            <div style={{ fontFamily: fontMono, fontSize: "13px", color: T.textMuted, fontWeight: "500", marginTop: "2px" }}>{year}</div>
          </div>
          <button onClick={() => chgMonth(1)} aria-label="Next month" style={{ ...btnBase, background: "none", fontSize: "22px", color: T.textMuted, padding: "4px 10px", minHeight: "44px", minWidth: "44px" }}>›</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: bp.isMobile ? "16px" : "32px", padding: "6px 0" }}>
          <StatBox value={weeks.length} label="Weeks" color={T.accent} />
          <StatBox value={activeDates.length} label="Active" color={T.mint} />
          <StatBox value={schedule ? `${filledSlots}/${totalSlots}` : "—"} label="Filled" color={filledSlots === totalSlots ? T.green : T.amber} />
        </div>
      </div>

      {/* NAV */}
      <div role="tablist" style={{ display: "flex", gap: "4px", padding: bp.isMobile ? "8px 8px" : "10px 12px", overflowX: "auto", borderBottom: `1px solid ${T.border}`, background: T.bgCard }}>
        {navItems.map(n => <button key={n.key} role="tab" aria-selected={view === n.key} onClick={() => setView(n.key)} style={{ ...btnBase, padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap", letterSpacing: "0.03em", background: view === n.key ? `linear-gradient(135deg,${T.accent},${T.accentHover})` : "transparent", color: view === n.key ? "#fff" : T.textMuted, boxShadow: view === n.key ? `0 0 14px ${T.accentGlow}` : "none", minHeight: "44px" }}>{n.icon} {n.label}</button>)}
      </div>

      <div style={{ padding: bp.isMobile ? "12px" : "16px", maxWidth: bp.isWide ? "960px" : bp.isDesktop ? "800px" : "720px", margin: "0 auto" }}>

        {/* ═══ PLAN TAB ═══ */}
        {view === "plan" && <div>
          <SectionHead icon="🗓" title="Week Planner" sub="Set which days training runs each week. Shift, cancel, or reschedule." />
          <Card style={{ marginBottom: "16px", padding: "14px", border: `1px solid ${T.accent}20`, background: T.accentSoft }}>
            <p style={{ fontSize: "13px", color: T.accent, margin: 0, lineHeight: 1.5, fontWeight: "500" }}>
              <strong>◀ ▶</strong> shifts all 3 days forward/back by one day. Use dropdowns for individual day changes. <strong>Cancel</strong> removes the entire week.
            </p>
          </Card>
          {weeks.map((wd, wi) => <WeekPlanner key={wi} weekIndex={wi} weekDays={wd} plan={weekPlans[`week${wi}`]} config={config} onChange={plan => updateWeekPlan(wi, plan)} isMobile={bp.isMobile} />)}
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: T.textMuted, marginBottom: "12px" }}>Once your days are set, go to <strong style={{ color: T.text }}>Actors</strong> to mark availability.</p>
            <Btn onClick={() => setView("availability")}>📋 Set Availability →</Btn>
          </div>
        </div>}

        {/* ═══ AVAILABILITY TAB ═══ */}
        {view === "availability" && <div>
          <SectionHead icon="📋" title="Actor Availability" sub="Tap names to toggle available/unavailable for each active day." right={<Btn variant="small" onClick={copyFromLastMonth} style={{ fontSize: "11px" }}>📋 Copy Last Month</Btn>} />
          {weeks.map((wd, wi) => {
            const plan = weekPlans[`week${wi}`] || getDefaultWeekPlan(wd, config);
            const activeSlots = SLOT_KEYS.filter(sk => plan[sk]);
            if (!activeSlots.length) return <Card key={wi} style={{ marginBottom: "10px", opacity: 0.5 }}><span style={{ fontFamily: fontMono, fontSize: "11px", color: T.textMuted }}>WK{wi + 1}</span> <Badge type="error">CANCELED</Badge></Card>;
            return <div key={wi} style={{ marginBottom: "20px" }}>
              <div style={{ fontFamily: fontMono, fontSize: "11px", fontWeight: "700", color: T.textMuted, letterSpacing: "1.5px", marginBottom: "8px" }}>WEEK {wi + 1}</div>
              {activeSlots.map(sk => {
                const ds = plan[sk]; if (!ds) return null;
                const dayInfo = wd.find(w => w.date === ds);
                const scenarios = config.slotScenarios[sk] || [];
                const approvedSet = new Set(scenarios.flatMap(s => config.scenarioActors[s] || []));
                const approvedAvail = [...approvedSet].filter(a => availability[ds]?.[a]).length;
                const cl = slotColors[sk];
                return <Card key={sk} style={{ marginBottom: "8px" }} accent={cl}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><SlotBar slotKey={sk} /><div><div style={{ fontWeight: "700", fontSize: "15px", color: T.text }}>{dayInfo?.dayName} <span style={{ fontFamily: fontMono, fontSize: "12px", color: T.textMuted, fontWeight: "500" }}>{fmtDate(ds)}</span></div><div style={{ fontSize: "11px", color: T.textFaint }}>{config.slotNames[sk]} · {scenarios.map(s => config.scenarioIcons[s]).join(" ")}</div></div></div>
                    <Badge type={approvedAvail >= 3 ? "success" : approvedAvail >= 2 ? "warning" : "error"}>{approvedAvail} ready</Badge>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                    {config.actors.map(actor => <Chip key={actor} active={!!availability[ds]?.[actor]} dimmed={!approvedSet.has(actor)} color={config.actorColors[actor]} onClick={() => toggleActor(ds, actor)}>{actor}</Chip>)}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}><Btn variant="small" onClick={() => setAllAvail(ds)} style={{ minHeight: "36px" }}>✓ All</Btn><Btn variant="small" onClick={() => clearDay(ds)} style={{ minHeight: "36px" }}>✕ Clear</Btn></div>
                </Card>;
              })}
            </div>;
          })}
          <div style={{ height: "80px" }} />
          <div style={{ position: "sticky", bottom: "16px", textAlign: "center", padding: "12px 8px", background: `linear-gradient(to top, ${T.bg} 60%, transparent)`, borderRadius: "16px" }}><Btn onClick={handleGenerate} disabled={generating} style={{ width: "100%", maxWidth: "400px", padding: "16px", fontSize: "15px", borderRadius: "14px", boxShadow: `0 0 32px ${T.accentGlow}, 0 4px 12px rgba(180,140,110,0.15)` }}>{generating ? "Generating..." : "⚡ Generate Schedule"}</Btn></div>
        </div>}

        {/* ═══ SCHEDULE TAB ═══ */}
        {view === "schedule" && <div>
          {!schedule ? <Card style={{ textAlign: "center", padding: "48px 20px" }}><div style={{ fontSize: "44px", marginBottom: "10px" }}>📅</div><h3 style={{ fontSize: "17px", fontWeight: "800", color: T.text, margin: "0 0 8px" }}>No schedule yet</h3><p style={{ fontSize: "14px", color: T.textMuted, margin: "0 0 16px" }}>Set your plan and availability first.</p><Btn onClick={() => setView("plan")}>🗓 Go to Plan →</Btn></Card> : <>
            {errors.length > 0 && <Card style={{ marginBottom: "14px", border: `1px solid ${T.red}30`, background: T.redSoft }}><p style={{ fontWeight: "700", fontSize: "13px", color: T.red, margin: "0 0 6px" }}>⚠️ {errors.length} unfilled slot{errors.length > 1 ? "s" : ""}</p>{errors.map((e, i) => <p key={i} style={{ fontSize: "12px", color: T.textSoft, margin: "2px 0" }}>{e}</p>)}</Card>}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}><Btn onClick={exportICSFile} disabled={exporting} style={{ flex: 1, minWidth: "140px" }}>{exporting ? "Exporting..." : "📥 Google Calendar"}</Btn><Btn variant="secondary" onClick={() => setShowShare(true)} style={{ flex: 1, minWidth: "140px" }}>📤 Share / Text</Btn></div>
            <p style={{ fontSize: "12px", color: T.textMuted, marginBottom: "14px" }}>Dropdowns let you swap any actor. Saves automatically.</p>
            {weeks.map((wd, wi) => {
              const wk = `week${wi}`, plan = weekPlans[wk] || getDefaultWeekPlan(wd, config);
              const activeSlots = SLOT_KEYS.filter(sk => plan[sk] && schedule[wk]?.[sk]);
              if (!activeSlots.length) return <Card key={wi} style={{ marginBottom: "8px", opacity: 0.5 }}><span style={{ fontFamily: fontMono, fontSize: "11px", color: T.textMuted }}>WK{wi + 1}</span> <Badge type="error">CANCELED</Badge></Card>;
              return <div key={wi} style={{ marginBottom: "20px" }}>
                <div style={{ fontFamily: fontMono, fontSize: "11px", fontWeight: "700", color: T.textMuted, letterSpacing: "1.5px", marginBottom: "8px" }}>WEEK {wi + 1}</div>
                {activeSlots.map(sk => {
                  const ds = plan[sk], di = wd.find(w => w.date === ds);
                  const scenarios = config.slotScenarios[sk] || [];
                  const cl = slotColors[sk];
                  return <Card key={sk} style={{ marginBottom: "8px" }} accent={cl}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}><SlotBar slotKey={sk} /><span style={{ fontWeight: "700", fontSize: "15px" }}>{di?.dayName}</span><span style={{ fontFamily: fontMono, fontSize: "12px", color: T.textMuted }}>{fmtDate(ds)}</span><Badge type="accent">{config.slotNames[sk]}</Badge></div>
                    {SHIFTS.map(shift => <div key={shift} style={{ marginBottom: shift === "AM" ? "14px" : 0 }}>
                      <div style={{ fontFamily: fontMono, fontSize: "10px", fontWeight: "700", color: T.textMuted, letterSpacing: "1px", marginBottom: "6px" }}>{shift === "AM" ? "☀️ NOON TOUR" : "🌙 8 PM TOUR"}</div>
                      {scenarios.map(sc => {
                        const actor = schedule[wk]?.[sk]?.[shift]?.[sc];
                        const approved = config.scenarioActors[sc] || [];
                        const availPick = approved.filter(a => availability[ds]?.[a]);
                        const acColor = actor ? (config.actorColors[actor] || T.textSoft) : null;
                        return <div key={sc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "10px", marginBottom: "4px", background: actor ? `${acColor}08` : T.redSoft, border: `1px solid ${actor ? `${acColor}20` : `${T.red}20`}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "15px" }}>{config.scenarioIcons[sc] || "🎭"}</span><span style={{ fontSize: "13px", fontWeight: "600" }}>{sc}</span></div>
                          <StyledSelect value={actor || ""} onChange={e => handleOverride(wk, sk, shift, sc, e.target.value || null)} style={{ minWidth: "110px" }}>
                            <option value="">— pick —</option>
                            {availPick.map(a => <option key={a}>{a}</option>)}
                            {approved.filter(a => !availPick.includes(a)).length > 0 && <option disabled>──────</option>}
                            {approved.filter(a => !availPick.includes(a)).map(a => <option key={a} value={a}>{a} (off)</option>)}
                          </StyledSelect>
                        </div>;
                      })}
                    </div>)}
                  </Card>;
                })}
              </div>;
            })}
          </>}
        </div>}

        {/* ═══ DASHBOARD TAB ═══ */}
        {view === "dashboard" && <div>
          <SectionHead icon="📊" title="Actor Stats" sub="Shift counts and workload distribution" />
          {!schedule && <Card style={{ marginBottom: "14px", textAlign: "center", padding: "24px 20px", border: `1px solid ${T.amber}25`, background: `${T.amber}08` }}><p style={{ fontSize: "14px", color: T.amber, fontWeight: "600", margin: "0 0 4px" }}>No schedule generated yet</p><p style={{ fontSize: "13px", color: T.textMuted, margin: 0 }}>Generate a schedule to see shift counts and workload balance.</p></Card>}
          {config.actors.map(actor => { const s = actorStats[actor] || { total: 0, scenarios: {} }; const cl = config.actorColors[actor] || T.textSoft; const approvedFor = Object.entries(config.scenarioActors).filter(([, a]) => a.includes(actor)).map(([sc]) => sc); const ad = activeDates.filter(d => availability[d]?.[actor]).length;
            return <Card key={actor} style={{ marginBottom: "8px" }} accent={s.total > 0 ? cl : null}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${cl}20`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "15px", color: cl, border: `1.5px solid ${cl}30` }}>{actor[0]}</div><div><div style={{ fontWeight: "700", fontSize: "14px" }}>{actor}</div><div style={{ fontSize: "11px", color: T.textMuted }}>Avail {ad}/{activeDates.length} · {s.total} shift{s.total !== 1 ? "s" : ""}</div></div></div>{s.total > 0 && <div style={{ fontFamily: fontMono, fontSize: "20px", fontWeight: "700", color: cl, textShadow: `0 0 12px ${cl}30` }}>{s.total}</div>}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>{approvedFor.map(sc => <span key={sc} style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", background: s.scenarios[sc] ? `${cl}15` : T.bgRaised, color: s.scenarios[sc] ? cl : T.textFaint, fontWeight: s.scenarios[sc] ? "600" : "400", border: `1px solid ${s.scenarios[sc] ? `${cl}25` : T.border}` }}>{config.scenarioIcons[sc] || ""} {sc}{s.scenarios[sc] ? ` ×${s.scenarios[sc]}` : ""}</span>)}</div>
            </Card>;
          })}
          {schedule && <Card style={{ marginTop: "14px", background: T.accentSoft }}><SectionHead icon="⚖️" title="Balance" /><div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>{config.actors.filter(a => (actorStats[a] || { total: 0 }).total > 0).sort((a, b) => (actorStats[b]?.total || 0) - (actorStats[a]?.total || 0)).map(actor => { const s = actorStats[actor] || { total: 0 }; const mx = Math.max(...config.actors.map(a => (actorStats[a] || { total: 0 }).total), 1); const pct = (s.total / mx) * 100; const cl = config.actorColors[actor] || T.accent; return <div key={actor} style={{ flex: "1 0 45%", minWidth: "140px" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}><span style={{ fontWeight: "600" }}>{actor}</span><span style={{ fontFamily: fontMono, color: T.textMuted, fontSize: "11px" }}>{s.total}</span></div><div style={{ height: "8px", borderRadius: "4px", background: T.border, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, borderRadius: "4px", background: `linear-gradient(90deg,${cl},${cl}BB)`, boxShadow: `0 0 8px ${cl}30`, transition: "width 0.4s" }} /></div></div> })}</div></Card>}
        </div>}

        {/* ═══ REFERENCE TAB ═══ */}
        {view === "reference" && <div>
          <SectionHead icon="📖" title="Quick Guide" />
          <Card style={{ marginBottom: "10px" }}><h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 10px" }}>🗓 Training Slots</h3>{SLOT_KEYS.map(sk => <div key={sk} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}><SlotBar slotKey={sk} /><div><span style={{ fontWeight: "700", fontSize: "13px" }}>{config.slotNames[sk]}</span><span style={{ fontSize: "12px", color: T.textMuted, marginLeft: "8px" }}>Default: {config.defaultDays[sk]}</span><div style={{ fontSize: "11px", color: T.textFaint, marginTop: "1px" }}>{(config.slotScenarios[sk] || []).map(s => `${config.scenarioIcons[s] || ""} ${s}`).join("  ·  ")}</div></div></div>)}</Card>
          <Card style={{ marginBottom: "10px" }}><h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 10px" }}>🎭 Approved Actors</h3>{Object.entries(config.scenarioActors).map(([sc, actors]) => <div key={sc} style={{ marginBottom: "8px" }}><div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "4px" }}>{config.scenarioIcons[sc] || "🎭"} {sc}</div><div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>{actors.map(a => <span key={a} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: `${config.actorColors[a] || T.textSoft}15`, color: config.actorColors[a] || T.textSoft, fontWeight: "500" }}>{a}</span>)}</div></div>)}</Card>
          <Card style={{ marginBottom: "10px" }}><h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 10px" }}>⚠️ Rules</h3><div style={{ fontSize: "13px", color: T.textSoft, lineHeight: 1.7 }}><p style={{ margin: "0 0 4px" }}>1 actor per scenario · 1 scenario per actor per shift</p>{(config.conflicts || []).map((r, i) => <p key={i} style={{ margin: "0 0 4px" }}>Can't play {r.actor_cannot_play.filter(Boolean).join(" + ")} same shift</p>)}<p style={{ margin: 0 }}>AM = {config.shiftTimes.AM} · PM = {config.shiftTimes.PM}</p></div></Card>
          <Card style={{ marginBottom: "10px" }}><h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 10px" }}>📝 Monthly Flow</h3><div style={{ fontSize: "13px", color: T.textSoft, lineHeight: 1.9 }}>{["By 15th — get actor availability", "Set up week plans (adjust for cancellations)", "Enter availability", "Generate schedule", "Review & adjust swaps", "Export to Google Calendar", "Share with actors"].map((s, i) => <p key={i} style={{ margin: "0 0 2px" }}>☐ {s}</p>)}</div></Card>
          <Card><h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 10px" }}>💡 Tips</h3><div style={{ fontSize: "13px", color: T.textSoft, lineHeight: 1.7 }}><p style={{ margin: "0 0 4px" }}><strong style={{ color: T.text }}>Snowstorm?</strong> Use the Plan tab to shift all days forward with ▶, or cancel the whole week.</p><p style={{ margin: "0 0 4px" }}><strong style={{ color: T.text }}>New actor?</strong> ⚙️ Settings → Actors → add them, then assign to scenarios.</p><p style={{ margin: "0 0 4px" }}><strong style={{ color: T.text }}>Scenario change?</strong> ⚙️ Settings → Scenarios to update who's approved.</p><p style={{ margin: 0 }}><strong style={{ color: T.text }}>Text actors</strong> via Share → pick Individual → select actor → copy.</p></div></Card>
        </div>}
      </div>

      <style>{`
        @keyframes slideDown{from{transform:translateX(-50%) translateY(-20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}
        select:focus,button:focus{outline:2px solid ${T.accent}40;outline-offset:2px}
        button:active{transform:scale(0.97)}
        select{color-scheme:light}
        option{background:${T.bgInput};color:${T.text}}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:${T.bg}}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        @media(max-width:480px){
          body{overflow-x:hidden}
        }
      `}</style>
    </div>
  );
}
