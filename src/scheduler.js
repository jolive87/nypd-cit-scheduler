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
  const schedule = {};
  const errors = [];

  // Track cumulative usage across the entire month for load-balancing
  const usageCount = {};
  for (const actor of config.actors) {
    usageCount[actor] = 0;
  }

  // Pre-calculate total eligible slots per actor for fairness tie-breaking.
  // Actors with fewer opportunities get priority when usage counts are tied.
  const eligibleCount = {};
  for (const actor of config.actors) {
    eligibleCount[actor] = 0;
  }
  for (let ewi = 0; ewi < weeks.length; ewi++) {
    const ewk = `week${ewi}`;
    const ewp = weekPlans[ewk] || getDefaultWeekPlan(weeks[ewi], config);
    if (!ewp) continue;
    for (const esk of SLOT_KEYS) {
      const edate = ewp[esk];
      if (!edate) continue;
      const eda = availability[edate] || {};
      const esc = slotScenarios[esk] || [];
      for (const eshift of SHIFTS) {
        for (const escenario of esc) {
          const eapproved = scenarioActors[escenario] || [];
          for (const actor of eapproved) {
            if (isAvailableForShift(eda[actor], eshift)) {
              eligibleCount[actor]++;
            }
          }
        }
      }
    }
  }

  for (let wi = 0; wi < weeks.length; wi++) {
    const weekKey = `week${wi}`;
    const wp = weekPlans[weekKey] || getDefaultWeekPlan(weeks[wi], config);
    if (!wp) continue;

    schedule[weekKey] = {};

    // Collect all assignments for this week so we can enforce cross-slot
    // conflict rules within the same shift (AM or PM).
    // Structure: weekAssignments[shift][actor] = Set of scenario names
    const weekAssignments = { AM: {}, PM: {} };

    for (const slotKey of SLOT_KEYS) {
      const date = wp[slotKey];
      if (!date) {
        // Slot canceled — skip
        schedule[weekKey][slotKey] = null;
        continue;
      }

      const scenarios = slotScenarios[slotKey];
      if (!scenarios || scenarios.length === 0) {
        schedule[weekKey][slotKey] = { date, AM: {}, PM: {} };
        continue;
      }

      const dayAvail = availability[date] || {};
      const slotResult = { date, AM: {}, PM: {} };

      for (const shift of SHIFTS) {
        // Track actors used within this specific shift+slot so each actor
        // gets at most 1 scenario per shift within this slot.
        const usedInShiftSlot = new Set();

        // Sort scenarios by scarcity: fewer available+approved actors first
        const scenarioOrder = [...scenarios].sort((a, b) => {
          const countA = candidateCount(a, dayAvail, scenarioActors, shift);
          const countB = candidateCount(b, dayAvail, scenarioActors, shift);
          return countA - countB;
        });

        for (const scenario of scenarioOrder) {
          const approved = scenarioActors[scenario];
          if (!approved || approved.length === 0) {
            slotResult[shift][scenario] = null;
            errors.push(
              `Wk${wi + 1} ${fmtDateShort(date)} ${shift}: No approved actors for ${scenario}`
            );
            continue;
          }

          // Filter candidates
          const candidates = approved.filter((actor) => {
            // Must be available for this shift (AM/PM aware)
            if (!isAvailableForShift(dayAvail[actor], shift)) return false;
            // Must not already be assigned in this shift+slot
            if (usedInShiftSlot.has(actor)) return false;
            // Must not already be assigned in this shift in another slot
            // (1 scenario per actor per shift across ALL slots)
            if (weekAssignments[shift][actor] && weekAssignments[shift][actor].size > 0) {
              return false;
            }
            // Conflict rules: check across all slots in same shift
            if (hasConflict(actor, scenario, shift, weekAssignments, conflicts)) {
              return false;
            }
            return true;
          });

          if (candidates.length === 0) {
            slotResult[shift][scenario] = null;
            errors.push(
              `Wk${wi + 1} ${fmtDateShort(date)} ${shift}: No actor for ${scenario}`
            );
            continue;
          }

          // Sort by lowest total usage; break ties by fewer opportunities first
          candidates.sort((a, b) => {
            const usageDiff = usageCount[a] - usageCount[b];
            if (usageDiff !== 0) return usageDiff;
            return eligibleCount[a] - eligibleCount[b];
          });

          const chosen = candidates[0];
          slotResult[shift][scenario] = chosen;
          usedInShiftSlot.add(chosen);
          usageCount[chosen]++;

          // Track in week-level assignments for cross-slot conflict checking
          if (!weekAssignments[shift][chosen]) {
            weekAssignments[shift][chosen] = new Set();
          }
          weekAssignments[shift][chosen].add(scenario);
        }
      }

      schedule[weekKey][slotKey] = slotResult;
    }
  }

  return { schedule, errors };
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
