// CIT Actor Scheduler — scheduling algorithm, stats, and text generation

export const SLOT_KEYS = ["slot1", "slot2", "slot3"];
export const SHIFTS = ["AM", "PM"];

// ---------------------------------------------------------------------------
// Availability Helpers (AM/PM support)
// ---------------------------------------------------------------------------

/**
 * Normalize availability value. Handles backward compat: boolean true → "both".
 * @returns {"both"|"am"|"pm"|false}
 */
export function normalizeAvail(val) {
  if (val === true || val === "both") return "both";
  if (val === "am") return "am";
  if (val === "pm") return "pm";
  return false;
}

/**
 * Check if an availability value covers the given shift.
 */
function isAvailableForShift(availValue, shift) {
  const norm = normalizeAvail(availValue);
  if (!norm) return false;
  if (norm === "both") return true;
  return (norm === "am" && shift === "AM") || (norm === "pm" && shift === "PM");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const DAYS_LONG = [
  "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday",
];

/**
 * "2026-03-10" → "Mar 10"
 */
export function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

/**
 * "2026-03-10" → "Tue 3/10"
 */
export function fmtDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS_SHORT[dt.getDay()]} ${m}/${d}`;
}

/**
 * "2026-03-10" → "Tuesday Mar 10"
 */
function fmtDateLong(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS_LONG[dt.getDay()]} ${MONTHS_SHORT[m - 1]} ${d}`;
}

/**
 * Returns default week plan for a set of weekdays.
 * Maps config.defaultDays (object: { slot1: "Tuesday", slot2: "Wednesday", slot3: "Thursday" })
 * to the actual dates in the given weekDays array by matching day names.
 *
 * @param {Array} weekDays - array of { date, dayName, dow }
 * @param {Object} config - must have config.defaultDays = { slot1: "Tuesday", ... }
 * @returns {{ slot1: string|null, slot2: string|null, slot3: string|null }}
 */
export function getDefaultWeekPlan(weekDays, config) {
  const plan = {};
  for (const slotKey of SLOT_KEYS) {
    const targetDay = config.defaultDays[slotKey];
    const match = weekDays.find((wd) => wd.dayName === targetDay);
    plan[slotKey] = match ? match.date : null;
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Schedule Generation
// ---------------------------------------------------------------------------

/**
 * Auto-assigns actors to scenarios following all constraint rules.
 *
 * @param {Array<Array>} weeks - array of week arrays. Each week = [{ date, dayName, dow }, ...]
 * @param {Object} weekPlans - { week0: { slot1: "2026-03-10", slot2: null, ... }, ... }
 * @param {Object} availability - { "2026-03-10": { "Decatur": true, "Rumi": false, ... }, ... }
 * @param {Object} config - { actors, scenarioActors, slotScenarios, conflicts }
 * @returns {{ schedule: Object, errors: string[] }}
 */
export function generateSchedule(weeks, weekPlans, availability, config) {
  const { scenarioActors, slotScenarios, conflicts } = config;

  // ── Pre-compute eligible count for fairness tie-breaking ──────────────────
  const eligibleCount = {};
  for (const actor of config.actors) eligibleCount[actor] = 0;
  for (let ewi = 0; ewi < weeks.length; ewi++) {
    const ewk = `week${ewi}`;
    const ewp = weekPlans[ewk] || getDefaultWeekPlan(weeks[ewi], config);
    if (!ewp) continue;
    for (const esk of SLOT_KEYS) {
      const edate = ewp[esk];
      if (!edate) continue;
      const eda = availability[edate] || {};
      for (const eshift of SHIFTS) {
        for (const escenario of slotScenarios[esk] || []) {
          for (const actor of scenarioActors[escenario] || []) {
            if (!isAvailableForShift(eda[actor], eshift)) continue;
            const ec = config.actorConstraints?.[actor];
            if (ec?.allowedDays?.length > 0) {
              const [ey, em, ed_] = edate.split('-').map(Number);
              if (!ec.allowedDays.includes(DAYS_LONG[new Date(ey, em - 1, ed_).getDay()])) continue;
            }
            eligibleCount[actor]++;
          }
        }
      }
    }
  }

  // ── Build slot list and schedule skeleton ─────────────────────────────────
  const allSlots = [];
  const skeleton = {};
  for (let wi = 0; wi < weeks.length; wi++) {
    const weekKey = `week${wi}`;
    const wp = weekPlans[weekKey] || getDefaultWeekPlan(weeks[wi], config);
    if (!wp) continue;
    skeleton[weekKey] = {};
    for (const slotKey of SLOT_KEYS) {
      const date = wp[slotKey];
      if (!date) { skeleton[weekKey][slotKey] = null; continue; }
      skeleton[weekKey][slotKey] = { date, AM: {}, PM: {} };
      for (const shift of SHIFTS) {
        for (const scenario of slotScenarios[slotKey] || []) {
          skeleton[weekKey][slotKey][shift][scenario] = null;
          allSlots.push({ wi, weekKey, slotKey, shift, scenario, date });
        }
      }
    }
  }

  // ── State management ───────────────────────────────────────────────────────
  function freshState() {
    const sched = {};
    for (const [wk, wv] of Object.entries(skeleton)) {
      if (!wv) { sched[wk] = null; continue; }
      sched[wk] = {};
      for (const [sk, sv] of Object.entries(wv)) {
        if (!sv) { sched[wk][sk] = null; continue; }
        sched[wk][sk] = { date: sv.date, AM: { ...sv.AM }, PM: { ...sv.PM } };
      }
    }
    return {
      schedule: sched,
      wa: {},  // wa[weekKey][shift][actor] = Set<scenario>
      usageCount: Object.fromEntries(config.actors.map(a => [a, 0])),
      pmCount: Object.fromEntries(config.actors.map(a => [a, 0])),
      backtrackCount: 0,
    };
  }

  function applyAssign(state, slot, actor) {
    const { weekKey, slotKey, shift, scenario } = slot;
    state.schedule[weekKey][slotKey][shift][scenario] = actor;
    if (!state.wa[weekKey]) state.wa[weekKey] = { AM: {}, PM: {} };
    const w = state.wa[weekKey];
    if (!w[shift][actor]) w[shift][actor] = new Set();
    w[shift][actor].add(scenario);
    state.usageCount[actor]++;
    if (shift === 'PM') state.pmCount[actor]++;
  }

  function undoAssign(state, slot, actor) {
    const { weekKey, slotKey, shift, scenario } = slot;
    state.schedule[weekKey][slotKey][shift][scenario] = null;
    const w = state.wa[weekKey];
    w[shift][actor].delete(scenario);
    if (w[shift][actor].size === 0) delete w[shift][actor];
    state.usageCount[actor]--;
    if (shift === 'PM') state.pmCount[actor]--;
  }

  // ── Constraint-aware candidate filter ─────────────────────────────────────
  // relaxLevel: 0=strict, 1=ignore PM cap, 2=+ignore allowedDays, 3=+ignore conflicts
  function getEligible(slot, state, relaxLevel) {
    const { weekKey, shift, scenario, date } = slot;
    const approved = scenarioActors[scenario] || [];
    const dayAvail = availability[date] || {};
    const w = state.wa[weekKey] || { AM: {}, PM: {} };
    return approved.filter(actor => {
      if (!isAvailableForShift(dayAvail[actor], shift)) return false;
      if (w[shift][actor]?.size > 0) return false;
      const ac = config.actorConstraints?.[actor];
      if (relaxLevel < 3 && hasConflict(actor, scenario, shift, w, conflicts)) return false;
      if (relaxLevel < 2 && ac?.allowedDays?.length > 0) {
        const [dy, dm, dd] = date.split('-').map(Number);
        if (!ac.allowedDays.includes(DAYS_LONG[new Date(dy, dm - 1, dd).getDay()])) return false;
      }
      if (relaxLevel < 1 && shift === 'PM' && ac?.maxPMRatio != null) {
        if (ac.maxPMRatio === 0) return false;
        if (state.usageCount[actor] > 0 &&
            state.pmCount[actor] / state.usageCount[actor] >= ac.maxPMRatio) return false;
      }
      return true;
    });
  }

  function rankCandidates(candidates, shift, state) {
    return [...candidates].sort((a, b) => {
      const ud = state.usageCount[a] - state.usageCount[b];
      if (ud !== 0) return ud;
      if (shift === 'PM') {
        const pa = config.actorConstraints?.[a]?.preferAM ? 1 : 0;
        const pb = config.actorConstraints?.[b]?.preferAM ? 1 : 0;
        if (pa !== pb) return pa - pb;
      }
      return eligibleCount[a] - eligibleCount[b];
    });
  }

  // ── Backtracking search with MRV + forward checking ───────────────────────
  function backtrack(slots, idx, state, relaxLevel) {
    if (idx === slots.length) return true;
    if (++state.backtrackCount > 50000) return false;

    // MRV: swap the slot with the fewest eligible candidates to current position
    let mrvIdx = idx, mrvCount = Infinity;
    for (let i = idx; i < slots.length; i++) {
      const cnt = getEligible(slots[i], state, relaxLevel).length;
      if (cnt < mrvCount) { mrvCount = cnt; mrvIdx = i; }
    }
    [slots[idx], slots[mrvIdx]] = [slots[mrvIdx], slots[idx]];
    const slot = slots[idx];

    const candidates = rankCandidates(getEligible(slot, state, relaxLevel), slot.shift, state);
    if (candidates.length === 0) {
      [slots[idx], slots[mrvIdx]] = [slots[mrvIdx], slots[idx]]; // swap back
      return false;
    }

    for (const actor of candidates) {
      applyAssign(state, slot, actor);
      // Forward check: no remaining slot should drop to 0 eligible candidates
      let ok = true;
      for (let i = idx + 1; i < slots.length; i++) {
        if (getEligible(slots[i], state, relaxLevel).length === 0) { ok = false; break; }
      }
      if (ok && backtrack(slots, idx + 1, state, relaxLevel)) return true;
      undoAssign(state, slot, actor);
    }

    [slots[idx], slots[mrvIdx]] = [slots[mrvIdx], slots[idx]]; // swap back
    return false;
  }

  // ── Try backtracking at each relaxation level ─────────────────────────────
  for (let relaxLevel = 0; relaxLevel <= 3; relaxLevel++) {
    const state = freshState();
    if (backtrack([...allSlots], 0, state, relaxLevel)) {
      return { schedule: state.schedule, errors: [] };
    }
  }

  // ── Greedy fallback: runs when pool is genuinely too thin ─────────────────
  // Fills what it can with strict constraints; builds rich diagnostics for gaps.
  function explainElim(actor, slot, state) {
    const { weekKey, shift, scenario, date } = slot;
    const dayAvail = availability[date] || {};
    const w = state.wa[weekKey] || { AM: {}, PM: {} };
    const ac = config.actorConstraints?.[actor];
    if (!isAvailableForShift(dayAvail[actor], shift)) {
      const norm = normalizeAvail(dayAvail[actor]);
      return norm
        ? `Only available ${norm === 'am' ? 'AM' : 'PM'} on ${fmtDateShort(date)}`
        : `Not marked available on ${fmtDateShort(date)}`;
    }
    if (w[shift][actor]?.size > 0) {
      return `Already used in ${shift} (${[...w[shift][actor]].join(', ')})`;
    }
    if (ac?.allowedDays?.length > 0) {
      const [dy, dm, dd] = date.split('-').map(Number);
      const dow = DAYS_LONG[new Date(dy, dm - 1, dd).getDay()];
      if (!ac.allowedDays.includes(dow)) return `Only available on ${ac.allowedDays.join('/')} (this is ${dow})`;
    }
    if (shift === 'PM' && ac?.maxPMRatio != null) {
      if (ac.maxPMRatio === 0) return `PM not permitted`;
      if (state.usageCount[actor] > 0 && state.pmCount[actor] / state.usageCount[actor] >= ac.maxPMRatio)
        return `PM cap reached (${Math.round(ac.maxPMRatio * 100)}% max)`;
    }
    if (hasConflict(actor, scenario, shift, w, conflicts)) return `Conflict rule with already-assigned scenario`;
    return null;
  }

  const fbState = freshState();
  const errors = [];

  for (let wi = 0; wi < weeks.length; wi++) {
    const weekKey = `week${wi}`;
    const wp = weekPlans[weekKey] || getDefaultWeekPlan(weeks[wi], config);
    if (!wp) continue;
    for (const slotKey of SLOT_KEYS) {
      const date = wp[slotKey];
      if (!date) continue;
      const dayAvail = availability[date] || {};
      for (const shift of SHIFTS) {
        const scenarioOrder = [...(slotScenarios[slotKey] || [])].sort((a, b) =>
          candidateCount(a, dayAvail, scenarioActors, shift) -
          candidateCount(b, dayAvail, scenarioActors, shift)
        );
        for (const scenario of scenarioOrder) {
          const slot = { wi, weekKey, slotKey, shift, scenario, date };
          const candidates = rankCandidates(getEligible(slot, fbState, 0), shift, fbState);
          if (candidates.length === 0) {
            const approved = scenarioActors[scenario] || [];
            const eliminations = approved.flatMap(actor => {
              const r = explainElim(actor, slot, fbState);
              return r ? [{ actor, reason: r }] : [];
            });
            const filledCount = approved.length - eliminations.length;
            errors.push({
              slot: `Wk${wi + 1} ${fmtDateShort(date)} ${shift}`,
              scenario, shift, date, weekKey, slotKey,
              approvedActors: approved,
              eliminations,
              suggestion: filledCount === 0
                ? `All ${approved.length} approved actor${approved.length !== 1 ? 's' : ''} blocked. Approve more actors for ${scenario} or adjust availability.`
                : `${filledCount} actor${filledCount !== 1 ? 's' : ''} eligible but already placed this shift. Approve more actors for ${scenario}.`,
            });
            continue;
          }
          applyAssign(fbState, slot, candidates[0]);
        }
      }
    }
  }

  return { schedule: fbState.schedule, errors };
}

/**
 * Count how many actors are both approved AND available for a scenario+shift.
 */
function candidateCount(scenario, dayAvail, scenarioActors, shift) {
  const approved = scenarioActors[scenario];
  if (!approved) return 0;
  return approved.filter((actor) => isAvailableForShift(dayAvail[actor], shift)).length;
}

/**
 * Check whether assigning `actor` to `scenario` in `shift` would violate
 * any conflict rule, considering all existing assignments across all slots
 * in the same week+shift.
 */
function hasConflict(actor, scenario, shift, weekAssignments, conflicts) {
  if (!conflicts || conflicts.length === 0) return false;

  const actorScenarios = weekAssignments[shift][actor];
  if (!actorScenarios || actorScenarios.size === 0) return false;

  for (const rule of conflicts) {
    if (rule.scope !== "same_shift") continue;

    const pair = rule.actor_cannot_play;
    if (!pair || pair.length < 2) continue;

    // Check if the scenario we want to assign is in the conflict pair
    // AND the actor already has the other scenario in this shift
    if (pair.includes(scenario)) {
      for (const otherScenario of pair) {
        if (otherScenario !== scenario && actorScenarios.has(otherScenario)) {
          return true;
        }
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Actor Stats
// ---------------------------------------------------------------------------

/**
 * Calculates per-actor statistics from a generated schedule.
 *
 * @param {Array<Array>} weeks
 * @param {Object} weekPlans
 * @param {Object} schedule
 * @param {Object} config
 * @returns {Object} - { "Decatur": { total: 4, scenarios: { "Depression": 2, ... } }, ... }
 */
export function getActorStats(weeks, weekPlans, schedule, config) {
  const stats = {};

  for (const actor of config.actors) {
    stats[actor] = { total: 0, scenarios: {} };
  }

  if (!schedule) return stats;

  for (let wi = 0; wi < weeks.length; wi++) {
    const weekKey = `week${wi}`;
    const weekSched = schedule[weekKey];
    if (!weekSched) continue;

    for (const slotKey of SLOT_KEYS) {
      const slotData = weekSched[slotKey];
      if (!slotData) continue; // canceled

      for (const shift of SHIFTS) {
        const shiftAssignments = slotData[shift];
        if (!shiftAssignments) continue;

        for (const [scenario, actor] of Object.entries(shiftAssignments)) {
          if (!actor) continue; // unfilled
          if (!stats[actor]) {
            // Actor exists in schedule but was removed from config — still count
            stats[actor] = { total: 0, scenarios: {} };
          }
          stats[actor].total++;
          stats[actor].scenarios[scenario] =
            (stats[actor].scenarios[scenario] || 0) + 1;
        }
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Share Text — Full Schedule
// ---------------------------------------------------------------------------

/**
 * Generates formatted plain text of the full monthly schedule.
 *
 * @param {Array<Array>} weeks
 * @param {Object} weekPlans
 * @param {Object} schedule
 * @param {string} monthName - e.g. "March"
 * @param {number|string} year - e.g. 2026
 * @param {Object} config - needs scenarioIcons, slotNames, slotScenarios
 * @returns {string}
 */
export function genShareText(weeks, weekPlans, schedule, monthName, year, config) {
  const icons = config.scenarioIcons || {};
  const slotNames = config.slotNames || { slot1: "Day 1", slot2: "Day 2", slot3: "Day 3" };
  const shiftLabels = { AM: "\u2600\uFE0F Noon", PM: "\uD83C\uDF19 8PM" };

  const lines = [];
  lines.push("\uD83D\uDCCB CIT ACTOR SCHEDULE");
  lines.push(`${monthName.toUpperCase()} ${year}`);
  lines.push("\u2501".repeat(32));

  for (let wi = 0; wi < weeks.length; wi++) {
    const weekKey = `week${wi}`;
    const wp = weekPlans[weekKey] || getDefaultWeekPlan(weeks[wi], config);
    const weekSched = schedule[weekKey];

    lines.push("");

    // Check if entire week is canceled (all slots null)
    const allCanceled =
      !wp ||
      SLOT_KEYS.every((sk) => !wp[sk]);

    if (allCanceled) {
      lines.push(`WEEK ${wi + 1}  \u00B7  CANCELED`);
      continue;
    }

    lines.push(`WEEK ${wi + 1}`);
    lines.push("\u2500".repeat(28));

    for (let si = 0; si < SLOT_KEYS.length; si++) {
      const slotKey = SLOT_KEYS[si];
      const date = wp ? wp[slotKey] : null;

      if (!date) continue; // slot canceled

      const slotData = weekSched ? weekSched[slotKey] : null;
      const dayLabel = slotNames[slotKey] || `Day ${si + 1}`;

      lines.push(`\uD83D\uDCC5 ${fmtDateLong(date)} \u2014 ${dayLabel}`);

      for (const shift of SHIFTS) {
        const label = shiftLabels[shift];
        lines.push(`  ${label}:`);

        const scenarios = config.slotScenarios[slotKey] || [];
        for (const scenario of scenarios) {
          const actor =
            slotData && slotData[shift] ? slotData[shift][scenario] : null;
          const icon = icons[scenario] || "\u2022";
          const actorName = actor || "UNASSIGNED";
          lines.push(`    ${icon} ${scenario}: ${actorName}`);
        }
      }
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Share Text — Individual Actor Message
// ---------------------------------------------------------------------------

/**
 * Generates a personalized schedule message for a single actor.
 *
 * @param {string} actor - actor name
 * @param {Array<Array>} weeks
 * @param {Object} weekPlans
 * @param {Object} schedule
 * @param {string} monthName
 * @param {number|string} year
 * @param {Object} config
 * @returns {string}
 */
export function genActorMsg(actor, weeks, weekPlans, schedule, monthName, year, config) {
  const icons = config.scenarioIcons || {};
  const shiftLabels = { AM: "Noon", PM: "8 PM" };
  const assignments = [];

  for (let wi = 0; wi < weeks.length; wi++) {
    const weekKey = `week${wi}`;
    const wp = weekPlans[weekKey] || getDefaultWeekPlan(weeks[wi], config);
    const weekSched = schedule[weekKey];
    if (!wp || !weekSched) continue;

    for (const slotKey of SLOT_KEYS) {
      const date = wp[slotKey];
      if (!date) continue;

      const slotData = weekSched[slotKey];
      if (!slotData) continue;

      for (const shift of SHIFTS) {
        const shiftData = slotData[shift];
        if (!shiftData) continue;

        for (const [scenario, assigned] of Object.entries(shiftData)) {
          if (assigned === actor) {
            const icon = icons[scenario] || "\u2022";
            assignments.push({
              date,
              shift,
              scenario,
              icon,
              label: `\uD83D\uDCC5 ${fmtDateLong(date)} \u2014 ${shiftLabels[shift]}\n   ${icon} Playing: ${scenario}`,
            });
          }
        }
      }
    }
  }

  if (assignments.length === 0) {
    return [
      `Hi ${actor},`,
      "",
      `You're not scheduled for CIT in ${monthName} ${year}.`,
      "Let me know if your availability changes.",
      "",
      "Thank you!",
    ].join("\n");
  }

  const lines = [];
  lines.push(`Hi ${actor},`);
  lines.push("");
  lines.push(`Your CIT schedule for ${monthName} ${year}:`);

  for (const a of assignments) {
    lines.push("");
    lines.push(a.label);
  }

  lines.push("");
  lines.push(`Total: ${assignments.length} shift${assignments.length !== 1 ? "s" : ""}`);
  lines.push("");
  lines.push("Please confirm receipt. Thank you!");

  return lines.join("\n");
}
