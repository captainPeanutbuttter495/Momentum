import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const GOAL_LABELS = {
  LOSE_WEIGHT: "lose weight",
  GAIN_MUSCLE: "build muscle",
  MAINTAIN: "maintain their current fitness level",
};

const GOAL_COACHING = {
  LOSE_WEIGHT:
    "Emphasize fat burn zones, steady-state cardio, moderate intensity, and staying active throughout the day. Praise calorie-burning effort.",
  GAIN_MUSCLE:
    "Emphasize recovery quality, progressive overload, hitting weights hard on well-rested days, and taking rest days when recovery is low.",
  MAINTAIN:
    "Emphasize consistency, balanced effort between cardio and strength, and avoiding overtraining or burnout.",
};

export function buildSystemPrompt(profile, userName) {
  const name = userName || "there";

  let clientInfo;
  let goalLine;
  let goalCoaching;

  if (profile) {
    const goal = GOAL_LABELS[profile.goal] || "improve their health";
    goalCoaching = GOAL_COACHING[profile.goal] || GOAL_COACHING.MAINTAIN;
    const heightStr = profile.heightFeet
      ? `${profile.heightFeet}'${profile.heightInches || 0}"`
      : "unknown height";

    clientInfo = `About your client:
- Name: ${name}
- Goal: ${goal} (currently ${profile.weightLbs} lbs${profile.targetWeightLbs ? `, targeting ${profile.targetWeightLbs} lbs` : ""})
- Age: ${profile.age}, ${profile.gender || "unspecified"}, ${heightStr}`;

    goalLine = `Their goal is to ${goal}.`;
  } else {
    clientInfo = `Your client's name is ${name}. They haven't finished setting up their profile yet, so you don't have their specific stats.`;
    goalLine = "Give general fitness guidance until they complete their profile.";
    goalCoaching = GOAL_COACHING.MAINTAIN;
  }

  return `You are a daily briefing system for a fitness app. You produce extremely concise, scannable insights. If it takes more than 5 seconds to read, it's too long.

${clientInfo}

${goalLine}

Coaching focus:
${goalCoaching}

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{"headline":"...","keySignals":["...","..."],"focus":["...","..."]}

Rules:
- headline: Max 8 words. The single takeaway.
- keySignals: Max 2 bullets. What the data says. Reference numbers only when critical (e.g., "~7h sleep, good quality"). Keep each under 8 words.
- focus: Max 2 bullets. Gentle guidance, not prescriptions. Say "keep activity steady" not "do a 30-minute jog at moderate pace". Keep each under 10 words.
- Never prescribe specific exercises, durations, or exact numbers unless truly critical
- Never repeat the same idea in different words
- Never mention calorie intake or diet
- Prioritize clarity over detail
- Tone: supportive, practical, brief
- If you see the same exercise at the same weight/reps for 2+ recent sessions, gently suggest increasing weight (2.5–5 lbs) or adding 1–2 reps per set

Strict grounding rules (CRITICAL — never violate these):
- ONLY reference activities that actually appear in the data. If no workout is listed under "Workouts:", do NOT mention workouts, cardio sessions, training, or exercise.
- Steps and active minutes are DAILY MOVEMENT, not workouts. High steps (e.g., 12,000) means strong daily activity — never call it "cardio" or a "session."
- "Cardio" only applies when a Fitbit-tracked workout with Cardio HR zones appears in the data.
- Do not infer, guess, or assume activities that are not explicitly present. If the data doesn't say it happened, it didn't happen.
- Never use generic fitness phrases like "build on momentum" or "keep up the cardio" unless the specific activity is in the data.
- Ground every statement in a specific data point. If you can't point to the exact number or entry that justifies a claim, don't make it.`;
}

function formatMinutes(totalMin) {
  if (totalMin == null) return "N/A";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatTime(isoString) {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "N/A";
  }
}

export function buildUserMessage({ context, date, sleep, activity, heartRate, workoutLogs, recentWorkouts }) {
  const parts = [];

  parts.push(`Here's my data for ${date}:\n`);

  // Sleep
  if (sleep?.summary) {
    const s = sleep.summary;
    const hours = Math.floor((s.totalMinutesAsleep || 0) / 60);
    const mins = (s.totalMinutesAsleep || 0) % 60;
    const efficiency = sleep.sleepLog?.[0]?.efficiency;
    const bedtime = formatTime(sleep.sleepLog?.[0]?.startTime);
    const wake = formatTime(sleep.sleepLog?.[0]?.endTime);

    parts.push(`Sleep: ${hours}h ${mins}min total${efficiency != null ? ` (${efficiency}% efficiency)` : ""}`);
    if (s.stages) {
      parts.push(`Stages: ${s.stages.deep || 0}min deep, ${s.stages.light || 0}min light, ${s.stages.rem || 0}min REM, ${s.stages.wake || 0}min awake`);
    }
    parts.push(`Bedtime: ${bedtime}, Woke up: ${wake}`);
  } else {
    parts.push("Sleep: No data available");
  }

  // Heart rate
  if (heartRate?.restingHeartRate) {
    parts.push(`Resting heart rate: ${heartRate.restingHeartRate} bpm`);
    if (context === "recap" && heartRate.zones) {
      const fatBurn = heartRate.zones.find((z) => z.name === "Fat Burn")?.minutes || 0;
      const cardio = heartRate.zones.find((z) => z.name === "Cardio")?.minutes || 0;
      const peak = heartRate.zones.find((z) => z.name === "Peak")?.minutes || 0;
      parts.push(`HR zones: ${fatBurn}min fat burn, ${cardio}min cardio, ${peak}min peak`);
    }
  } else {
    parts.push("Heart rate: No data available");
  }

  // Activity (recap only)
  if (context === "recap") {
    if (activity) {
      const activeMin = (activity.activeMinutes?.fairlyActive || 0) + (activity.activeMinutes?.veryActive || 0);
      parts.push(`\nSteps: ${activity.steps?.toLocaleString() || 0} (${activity.distance || 0} miles)`);
      parts.push(`Calories burned: ${activity.caloriesOut?.toLocaleString() || 0}`);
      parts.push(`Active minutes: ${activeMin} moderate-to-vigorous`);

      if (activity.workouts?.length > 0) {
        parts.push("\nWorkouts:");
        for (const w of activity.workouts) {
          const dur = Math.round((w.duration || 0) / 60000);
          let line = `- ${w.name}: ${dur}min, ${w.calories || 0} cal`;

          if (w.heartRateZones?.length > 0) {
            const fb = w.heartRateZones.find((z) => z.name === "Fat Burn")?.minutes || 0;
            const cardio = w.heartRateZones.find((z) => z.name === "Cardio")?.minutes || 0;
            const peak = w.heartRateZones.find((z) => z.name === "Peak")?.minutes || 0;
            if (fb + cardio + peak > 0) {
              line += ` (Fat Burn: ${fb}min, Cardio: ${cardio}min, Peak: ${peak}min`;
              if (w.averageHeartRate) {
                line += `, avg HR: ${w.averageHeartRate} bpm`;
              }
              line += `)`;
            }
          }

          parts.push(line);
        }
      } else {
        parts.push("\nWorkouts: None logged today");
      }
    } else {
      parts.push("\nActivity: No data available");
    }
  }

  // Manual exercise detail (from user-logged workouts)
  if (workoutLogs?.length > 0) {
    parts.push("\nManual exercise detail:");
    for (const log of workoutLogs) {
      for (const ex of log.exercises || []) {
        parts.push(`- ${ex.name}: ${ex.weightLbs} lbs × ${ex.sets} sets × ${ex.reps} reps`);
      }
    }
  }

  // Recent workout history for progressive overload analysis
  if (recentWorkouts?.length > 0) {
    parts.push("\nRecent workout history (last 2 weeks):");
    for (const log of recentWorkouts) {
      const exercises = (log.exercises || [])
        .map((ex) => `${ex.name} ${ex.weightLbs}lbs×${ex.sets}×${ex.reps}`)
        .join(", ");
      parts.push(`- ${log.date}: ${exercises}`);
    }
  }

  // Closing question
  if (context === "morning") {
    parts.push("\nWhat should I do for my workout today?");
  } else {
    parts.push("\nHow did my day go?");
  }

  return parts.join("\n");
}

export async function getCoachInsight({ context, date, profile, sleep, activity, heartRate, userName, workoutLogs, recentWorkouts }) {
  const systemPrompt = buildSystemPrompt(profile, userName);
  const userMessage = buildUserMessage({ context, date, sleep, activity, heartRate, workoutLogs, recentWorkouts });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content[0].text;

  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      headline: parsed.headline || "",
      keySignals: parsed.keySignals || [],
      focus: parsed.focus || [],
    };
  } catch {
    // Fallback if Claude doesn't return valid JSON
    return {
      headline: "Here's your update",
      keySignals: [],
      focus: [cleaned.slice(0, 200)],
    };
  }
}
