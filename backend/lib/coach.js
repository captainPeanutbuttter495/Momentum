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

  return `You are a recovery and readiness coach for a fitness app. Your single job: answer "How recovered is the user, and should they push harder, maintain effort, or pull back today?"

${clientInfo}

${goalLine}

Coaching focus:
${goalCoaching}

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{"headline":"...","keySignals":["...","..."],"focus":["...","..."]}

CORE PRINCIPLE — CHANGE over static values:
- If sleep improved or dropped vs yesterday, THAT is the story. If resting HR spiked or fell, THAT is the story.
- Lead with the BIGGEST change or the single most actionable signal.
- Every statement must answer: "Why does this matter TODAY?"
- If no yesterday data is provided, base decisions on how today's absolute values indicate recovery (e.g., deep sleep %, RHR level, efficiency).

Rules:
- headline: Max 8 words. Must include a clear DIRECTION — push harder, stay steady, or ease up. Never a vague observation ("sleep solid"). Say what it MEANS for today ("Well-rested — push intensity today").
- keySignals: Max 2 bullets. When yesterday's data is available, ALWAYS compare (e.g., "Sleep up 40min vs yesterday"). When values are stable, say so ("RHR steady at 58 — consistent recovery"). Max 15 words each.
- focus: Max 2 bullets. Tie guidance directly to recovery state. Say "well-rested — increase intensity today" not "keep up the good work". Max 12 words each.
- Never prescribe specific exercises, durations, or exact numbers unless truly critical
- Never repeat the same idea in different words
- Never mention calorie intake or diet
- Prioritize the STRONGEST signal — the one data point that most changes today's plan
- Tone: direct, concise, like a coach who knows the numbers
- NEVER invent progression advice from raw workout history alone. Only discuss load increases or rep increases when the exercise progression data includes a suggestionHint. If suggestionHint is absent, you may describe the trend briefly but do NOT recommend a change.

Context-specific rules:
- MORNING context: Plan the day ahead. Advise whether to push, maintain, or ease up today based on recovery signals.
- RECAP context: Reflect on what already happened today. Do NOT give advice for earlier in the day. Acknowledge what the user did, evaluate it, and frame all guidance for tomorrow or the next session. Recap should never tell the user what they should have done — it should tell them what to do next.

Strict grounding rules (CRITICAL — never violate these):
- ONLY reference activities that actually appear in the data. If no workout is listed under "Workouts:", do NOT mention workouts, cardio sessions, training, or exercise.
- Steps and active minutes are DAILY MOVEMENT, not workouts. High steps (e.g., 12,000) means strong daily activity — never call it "cardio" or a "session."
- "Cardio" only applies when a Fitbit-tracked workout with Cardio HR zones appears in the data.
- Do not infer, guess, or assume activities that are not explicitly present. If the data doesn't say it happened, it didn't happen.
- Never use generic fitness phrases like "build on momentum" or "keep up the cardio" unless the specific activity is in the data.
- Ground every statement in a specific data point. If you can't point to the exact number or entry that justifies a claim, don't make it.

TRAINING PROGRESSION COACH:
When workout summary and exercise progression data are provided, you also serve as a training progression coach.

Rules for training progression:
- Only discuss progressive overload when the data explicitly includes exercise progressions with 2+ sessions of the same exercise
- Base progression suggestions on the computed trend and suggestionHint — do not invent your own analysis
- If workoutStrain is "high" and recovery signals are poor (low sleep, elevated RHR), prioritize recovery messaging over load increase suggestions
- Distinguish structured strength training (exercises with weight/sets/reps) from general daily movement (steps, active minutes)
- Rep-first progression (HARD RULE): For exercises in the 8-12 target range, ALWAYS prefer rep increases before load increases. If reps are still below 12 at the current weight, do NOT recommend increasing load unless suggestionHint explicitly says to. Only recommend increasing weight when the user has reached the top of the rep range (12) across repeated sessions.
- Dropping below 8 reps after a weight increase means hold at that weight and build reps back up
- When trainingNote data is warranted, include a "trainingNote" field in your JSON response: {"headline":"...","keySignals":["..."],"focus":["..."],"trainingNote":"..."}
- trainingNote: Max 1 sentence. Summarize the most important progression insight naturally. Only include when workout/exercise data is present
- If no workout data or exercise progressions are provided, do NOT include trainingNote and do NOT mention training progression`;
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

export function buildUserMessage({ context, date, sleep, activity, heartRate, workoutLogs, recentWorkouts, yesterday, workoutSummary, exerciseProgressions }) {
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
    parts.push("\nRecent workout history (last 3 weeks):");
    for (const log of recentWorkouts) {
      const exercises = (log.exercises || [])
        .map((ex) => `${ex.name} ${ex.weightLbs}lbs×${ex.sets}×${ex.reps}`)
        .join(", ");
      parts.push(`- ${log.date}: ${exercises}`);
    }
  }

  // Workout summary (derived by app before prompting)
  if (workoutSummary) {
    parts.push("\nWorkout Summary:");
    parts.push(`- Type: ${workoutSummary.workoutType}, Duration: ${workoutSummary.durationMin}min, Exercises: ${workoutSummary.exerciseCount}`);
    parts.push(`- Body Region: ${workoutSummary.bodyRegion}, Intensity: ${workoutSummary.estimatedIntensity}, Volume: ${workoutSummary.estimatedVolume}`);
    parts.push(`- Workout Strain: ${workoutSummary.workoutStrain}`);
    const hrPart = workoutSummary.avgWorkoutHeartRate ? `Avg HR: ${workoutSummary.avgWorkoutHeartRate} bpm | ` : "";
    parts.push(`- ${hrPart}Fat Burn: ${workoutSummary.fatBurnZoneMinutes}min, Cardio: ${workoutSummary.cardioZoneMinutes}min, Peak: ${workoutSummary.peakZoneMinutes}min`);
  }

  // Exercise progressions (app-computed trends for AI to explain)
  if (exerciseProgressions?.length > 0) {
    parts.push("\nExercise Progressions (app-computed — explain naturally):");
    for (const prog of exerciseProgressions) {
      const sessionStr = prog.recentSessions
        .map((s) => `${s.sets}x${s.reps}`)
        .join(" → ");
      const weight = prog.recentSessions[0]?.weightLbs || 0;
      let line = `- ${prog.exercise}: ${weight}lbs (${sessionStr}) | Trend: ${prog.trend}`;
      if (prog.suggestionHint) line += ` | Hint: ${prog.suggestionHint}`;
      parts.push(line);
    }
  }

  // Yesterday's data for comparison
  if (yesterday) {
    parts.push("\n--- Yesterday's data (for comparison) ---");

    if (yesterday.sleep?.summary) {
      const ys = yesterday.sleep.summary;
      const yHours = Math.floor((ys.totalMinutesAsleep || 0) / 60);
      const yMins = (ys.totalMinutesAsleep || 0) % 60;
      const yEfficiency = yesterday.sleep.sleepLog?.[0]?.efficiency;
      parts.push(`Yesterday sleep: ${yHours}h ${yMins}min${yEfficiency != null ? ` (${yEfficiency}% efficiency)` : ""}`);
      if (ys.stages) {
        parts.push(`Yesterday stages: ${ys.stages.deep || 0}min deep, ${ys.stages.rem || 0}min REM`);
      }
    }

    if (yesterday.heartRate?.restingHeartRate) {
      parts.push(`Yesterday resting HR: ${yesterday.heartRate.restingHeartRate} bpm`);
    }

    if (context === "recap" && yesterday.activity) {
      const ya = yesterday.activity;
      const yActiveMin = (ya.activeMinutes?.fairlyActive || 0) + (ya.activeMinutes?.veryActive || 0);
      parts.push(`Yesterday steps: ${ya.steps?.toLocaleString() || 0}`);
      parts.push(`Yesterday active minutes: ${yActiveMin} moderate-to-vigorous`);
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

// Ensure a value is a flat array of strings (handles stringified arrays, nested arrays, etc.)
function toStringArray(val) {
  if (!val) return [];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // not JSON — treat as a single string item
    }
    return [val];
  }
  if (Array.isArray(val)) return val.map(String);
  return [];
}

// Extract fields from malformed or truncated JSON using regex
function recoverPartialInsight(text) {
  const headlineMatch = text.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const headline = headlineMatch ? headlineMatch[1] : "";

  const extractQuotedItems = (key) => {
    const section = text.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`));
    if (!section) return [];
    return [...section[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  };

  const trainingNoteMatch = text.match(/"trainingNote"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const result = {
    headline,
    keySignals: extractQuotedItems("keySignals"),
    focus: extractQuotedItems("focus"),
  };
  if (trainingNoteMatch?.[1]) {
    result.trainingNote = trainingNoteMatch[1];
  }
  return result;
}

export async function getCoachInsight({ context, date, profile, sleep, activity, heartRate, userName, workoutLogs, recentWorkouts, yesterday, workoutSummary, exerciseProgressions }) {
  const systemPrompt = buildSystemPrompt(profile, userName);
  const userMessage = buildUserMessage({ context, date, sleep, activity, heartRate, workoutLogs, recentWorkouts, yesterday, workoutSummary, exerciseProgressions });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content[0].text;

  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    const result = {
      headline: typeof parsed.headline === "string" ? parsed.headline : "",
      keySignals: toStringArray(parsed.keySignals),
      focus: toStringArray(parsed.focus),
    };
    if (typeof parsed.trainingNote === "string" && parsed.trainingNote) {
      result.trainingNote = parsed.trainingNote;
    }
    return result;
  } catch {
    // Try to recover usable fields from malformed/truncated JSON
    const recovered = recoverPartialInsight(cleaned);
    if (recovered.headline || recovered.keySignals.length > 0) {
      return recovered;
    }
    return {
      headline: "Here's your update",
      keySignals: [],
      focus: [],
    };
  }
}
