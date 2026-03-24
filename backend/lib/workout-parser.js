import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function parseWorkoutText(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return [];
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system: `You parse free-form workout descriptions into structured exercise data.
Return ONLY valid JSON — no markdown, no code fences.
Format: [{"name":"Exercise Name","weightLbs":30,"sets":3,"reps":10}, ...]

Rules:
- Extract exercise name, weight in pounds, sets, and reps from natural language
- If weight is in kg, convert to lbs (1 kg ≈ 2.2 lbs)
- If no weight is mentioned, use 0
- Common patterns: "3x10" means 3 sets of 10 reps, "3 sets of 10" same thing
- If sets/reps not specified, default to 1
- Preserve exercise names as the user wrote them (capitalize first letters)
- Return an empty array [] if no exercises can be parsed`,
    messages: [{ role: "user", content: text.trim() }],
  });

  const raw = response.content[0].text;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const exercises = JSON.parse(cleaned);
    if (!Array.isArray(exercises)) return [];
    return exercises.map((ex) => ({
      name: String(ex.name || "Unknown exercise"),
      weightLbs: typeof ex.weightLbs === "number" ? ex.weightLbs : parseFloat(ex.weightLbs) || 0,
      sets: typeof ex.sets === "number" ? Math.max(1, ex.sets) : 1,
      reps: typeof ex.reps === "number" ? Math.max(1, ex.reps) : 1,
    }));
  } catch {
    return [];
  }
}
