// ICS calendar export — RFC 5545 compliant .ics generation for Google Calendar
// Generates VEVENT entries for each CIT training shift (AM/PM) per active training day.

const SLOT_KEYS = ["slot1", "slot2", "slot3"];
const SHIFTS = ["AM", "PM"];

const CRLF = "\r\n";

// Shift time boundaries (Eastern)
const SHIFT_TIMES = {
  AM: { start: "120000", end: "160000" },
  PM: { start: "200000", end: "230000" },
};

const SHIFT_LABELS = {
  AM: "\u2600\uFE0F Noon Tour:",
  PM: "\uD83C\uDF19 Night Tour:",
};

// ---- RFC 5545 Line Folding ----
// Lines MUST NOT exceed 75 octets. Multi-byte characters must not be split.
function foldLine(line) {
  if (line.length <= 75) return line;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const parts = [];
  let offset = 0;
  let isFirst = true;

  while (offset < bytes.length) {
    // First line: 75 octets. Continuation lines: 74 octets (1 octet for leading space).
    const maxBytes = isFirst ? 75 : 74;
    let end = Math.min(offset + maxBytes, bytes.length);

    // Don't split in the middle of a multi-byte UTF-8 sequence.
    // UTF-8 continuation bytes start with 10xxxxxx (0x80-0xBF).
    if (end < bytes.length) {
      while (end > offset && (bytes[end] & 0xc0) === 0x80) {
        end--;
      }
    }

    const chunk = bytes.slice(offset, end);
    const decoded = new TextDecoder().decode(chunk);

    if (isFirst) {
      parts.push(decoded);
    } else {
      parts.push(" " + decoded);
    }

    offset = end;
    isFirst = false;
  }

  return parts.join(CRLF);
}

// Join and fold multiple content lines
function icsLines(lines) {
  return lines.map(foldLine).join(CRLF);
}

// Format date string "YYYY-MM-DD" -> "YYYYMMDD"
function dateToICS(dateStr) {
  return dateStr.replace(/-/g, "");
}

// Short month name from date string
function shortMonth(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleString("en-US", { month: "short" });
}

// Day of month from date string
function dayOfMonth(dateStr) {
  return parseInt(dateStr.split("-")[2], 10);
}

// ---- VTIMEZONE for America/New_York ----
function vtimezone() {
  return icsLines([
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "BEGIN:STANDARD",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
  ]);
}

// Build DESCRIPTION field value for a shift.
// Uses literal \n (backslash-n) for newlines inside the value — required by RFC 5545.
function buildDescription(slotKey, date, dayName, shift, assignments, config) {
  const slotName = config.slotNames[slotKey] || slotKey;
  const mon = shortMonth(date);
  const day = dayOfMonth(date);
  const scenarios = config.slotScenarios[slotKey] || [];

  const parts = [];
  parts.push(`${slotName} (${dayName} ${mon} ${day})`);
  parts.push("");
  parts.push(SHIFT_LABELS[shift]);

  for (const scenario of scenarios) {
    const icon = (config.scenarioIcons && config.scenarioIcons[scenario]) || "";
    const actor =
      assignments && assignments[scenario] ? assignments[scenario] : "UNASSIGNED";
    const prefix = icon ? `${icon} ` : "";
    parts.push(`${prefix}${scenario}: ${actor}`);
  }

  // Join with literal \n — NOT real newlines
  return parts.join("\\n");
}

// Build SUMMARY line: "CIT AM — Mania/Psychosis/Depression"
function buildSummary(shift, slotKey, config) {
  const scenarios = config.slotScenarios[slotKey] || [];
  return `CIT ${shift} \u2014 ${scenarios.join("/")}`;
}

// ---- Main Generator ----

export function generateICS(weeks, weekPlans, schedule, year, month, config) {
  const now = Date.now();
  const events = [];

  for (let wi = 0; wi < weeks.length; wi++) {
    const weekKey = `week${wi}`;
    const weekSchedule = schedule[weekKey];
    if (!weekSchedule) continue;

    // Fall back to default plan if no explicit plan set for this week
    const plan = weekPlans[weekKey] || getDefaultWeekPlan(weeks[wi], config);
    if (!plan) continue;

    for (const slotKey of SLOT_KEYS) {
      const date = plan[slotKey];
      // Canceled slot — no event
      if (!date) continue;

      const slotSchedule = weekSchedule[slotKey];
      if (!slotSchedule) continue;

      // Find the dayName for this date from the weeks array
      const weekDays = weeks[wi];
      const matchedDay = weekDays.find((d) => d.date === date);
      const dayName = matchedDay ? matchedDay.dayName : "";

      for (const shift of SHIFTS) {
        const assignments = slotSchedule[shift]; // { scenarioName: actorName | null }
        const times = SHIFT_TIMES[shift];
        const icsDate = dateToICS(date);

        const summary = buildSummary(shift, slotKey, config);
        const description = buildDescription(
          slotKey,
          date,
          dayName,
          shift,
          assignments,
          config
        );

        // UID: globally unique per event
        const uid = `cit-${date}-${shift}-${slotKey}-${now}@citscheduler`;

        const vevent = icsLines([
          "BEGIN:VEVENT",
          `DTSTART;TZID=America/New_York:${icsDate}T${times.start}`,
          `DTEND;TZID=America/New_York:${icsDate}T${times.end}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          "LOCATION:NYPD CIT Training",
          `UID:${uid}`,
          "STATUS:CONFIRMED",
          "END:VEVENT",
        ]);

        events.push(vevent);
      }
    }
  }

  // Month name for calendar title
  const monthName = new Date(year, month, 1).toLocaleString("en-US", {
    month: "long",
  });

  const cal = [
    icsLines([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CIT Scheduler//citscheduler//EN",
      `X-WR-CALNAME:CIT Training ${monthName} ${year}`,
    ]),
    vtimezone(),
    ...events,
    "END:VCALENDAR",
  ].join(CRLF);

  return cal;
}

// ---- Default Week Plan Helper ----
// Maps each slot to its default weekday within the given week.

export function getDefaultWeekPlan(weekDays, config) {
  const plan = {};
  for (const slotKey of SLOT_KEYS) {
    const targetDay = config.defaultDays[slotKey];
    const match = weekDays.find((d) => d.dayName === targetDay);
    plan[slotKey] = match ? match.date : null;
  }
  return plan;
}

// ---- Download Helper ----

export function downloadICS(icsString, monthName, year) {
  const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CIT_${monthName}_${year}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
