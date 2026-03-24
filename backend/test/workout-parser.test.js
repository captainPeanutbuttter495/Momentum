// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    constructor() {
      this.messages = { create: mockCreate };
    }
  },
}));

// ─── Import after mocks ────────────────────────────────────────────

const { parseWorkoutText } = await import("../lib/workout-parser.js");

// ─── Helpers ───────────────────────────────────────────────────────

function claudeReturns(text) {
  mockCreate.mockResolvedValue({
    content: [{ text }],
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("parseWorkoutText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Valid free-form text → structured exercises ──────────────

  it("returns structured exercises from valid free-form text", async () => {
    const jsonResponse = JSON.stringify([
      { name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 },
      { name: "Squat", weightLbs: 225, sets: 4, reps: 8 },
    ]);
    claudeReturns(jsonResponse);

    const result = await parseWorkoutText("bench press 135lbs 3x10, squat 225lbs 4x8");

    expect(result).toEqual([
      { name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 },
      { name: "Squat", weightLbs: 225, sets: 4, reps: 8 },
    ]);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-haiku-4-5-20251001");
  });

  // ── 2. Empty / null / undefined text → empty array ─────────────

  it("returns empty array when text is empty string", async () => {
    const result = await parseWorkoutText("");
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns empty array when text is null", async () => {
    const result = await parseWorkoutText(null);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns empty array when text is undefined", async () => {
    const result = await parseWorkoutText(undefined);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns empty array when text is whitespace-only", async () => {
    const result = await parseWorkoutText("   \n\t  ");
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // ── 3. Invalid JSON from Claude → empty array ─────────────────

  it("returns empty array when Claude returns invalid JSON", async () => {
    claudeReturns("this is not valid json at all");

    const result = await parseWorkoutText("bench press 135lbs");
    expect(result).toEqual([]);
  });

  it("returns empty array when Claude returns partial/broken JSON", async () => {
    claudeReturns('[{"name": "Bench Press", "weightLbs": 135');

    const result = await parseWorkoutText("bench press 135lbs");
    expect(result).toEqual([]);
  });

  // ── 4. Non-array JSON from Claude → empty array ───────────────

  it("returns empty array when Claude returns a JSON object instead of array", async () => {
    claudeReturns('{"name": "Bench Press", "weightLbs": 135, "sets": 3, "reps": 10}');

    const result = await parseWorkoutText("bench press 135lbs 3x10");
    expect(result).toEqual([]);
  });

  it("returns empty array when Claude returns a JSON string", async () => {
    claudeReturns('"just a string"');

    const result = await parseWorkoutText("bench press 135lbs");
    expect(result).toEqual([]);
  });

  it("returns empty array when Claude returns a JSON number", async () => {
    claudeReturns("42");

    const result = await parseWorkoutText("bench press 135lbs");
    expect(result).toEqual([]);
  });

  // ── 5. Markdown code fence cleaning ────────────────────────────

  it("cleans ```json code fences from Claude response", async () => {
    const json = JSON.stringify([
      { name: "Deadlift", weightLbs: 315, sets: 5, reps: 5 },
    ]);
    claudeReturns("```json\n" + json + "\n```");

    const result = await parseWorkoutText("deadlift 315lbs 5x5");

    expect(result).toEqual([
      { name: "Deadlift", weightLbs: 315, sets: 5, reps: 5 },
    ]);
  });

  it("cleans bare ``` code fences from Claude response", async () => {
    const json = JSON.stringify([
      { name: "Pull Ups", weightLbs: 0, sets: 3, reps: 12 },
    ]);
    claudeReturns("```\n" + json + "\n```");

    const result = await parseWorkoutText("pull ups 3x12");

    expect(result).toEqual([
      { name: "Pull Ups", weightLbs: 0, sets: 3, reps: 12 },
    ]);
  });

  // ── 6. Type coercion ──────────────────────────────────────────

  it("coerces string weightLbs to number", async () => {
    claudeReturns(JSON.stringify([
      { name: "Curl", weightLbs: "30", sets: 3, reps: 10 },
    ]));

    const result = await parseWorkoutText("curls 30lbs 3x10");

    expect(result[0].weightLbs).toBe(30);
    expect(typeof result[0].weightLbs).toBe("number");
  });

  it("defaults weightLbs to 0 when value is non-numeric string", async () => {
    claudeReturns(JSON.stringify([
      { name: "Push Ups", weightLbs: "bodyweight", sets: 3, reps: 15 },
    ]));

    const result = await parseWorkoutText("push ups 3x15");

    expect(result[0].weightLbs).toBe(0);
  });

  it("defaults missing sets to 1", async () => {
    claudeReturns(JSON.stringify([
      { name: "Bench Press", weightLbs: 135, reps: 10 },
    ]));

    const result = await parseWorkoutText("bench press 135lbs 10 reps");

    expect(result[0].sets).toBe(1);
  });

  it("defaults missing reps to 1", async () => {
    claudeReturns(JSON.stringify([
      { name: "Bench Press", weightLbs: 135, sets: 3 },
    ]));

    const result = await parseWorkoutText("bench press 135lbs 3 sets");

    expect(result[0].reps).toBe(1);
  });

  it("defaults string sets to 1", async () => {
    claudeReturns(JSON.stringify([
      { name: "Squat", weightLbs: 225, sets: "three", reps: 10 },
    ]));

    const result = await parseWorkoutText("squat 225lbs 3x10");

    expect(result[0].sets).toBe(1);
  });

  it("defaults string reps to 1", async () => {
    claudeReturns(JSON.stringify([
      { name: "Squat", weightLbs: 225, sets: 3, reps: "ten" },
    ]));

    const result = await parseWorkoutText("squat 225lbs 3x10");

    expect(result[0].reps).toBe(1);
  });

  it("clamps negative sets to 1", async () => {
    claudeReturns(JSON.stringify([
      { name: "Row", weightLbs: 100, sets: -2, reps: 10 },
    ]));

    const result = await parseWorkoutText("rows 100lbs");

    expect(result[0].sets).toBe(1);
  });

  it("clamps negative reps to 1", async () => {
    claudeReturns(JSON.stringify([
      { name: "Row", weightLbs: 100, sets: 3, reps: -5 },
    ]));

    const result = await parseWorkoutText("rows 100lbs");

    expect(result[0].reps).toBe(1);
  });

  it("clamps zero sets to 1", async () => {
    claudeReturns(JSON.stringify([
      { name: "Lateral Raise", weightLbs: 20, sets: 0, reps: 12 },
    ]));

    const result = await parseWorkoutText("lateral raise 20lbs");

    expect(result[0].sets).toBe(1);
  });

  it("clamps zero reps to 1", async () => {
    claudeReturns(JSON.stringify([
      { name: "Lateral Raise", weightLbs: 20, sets: 3, reps: 0 },
    ]));

    const result = await parseWorkoutText("lateral raise 20lbs");

    expect(result[0].reps).toBe(1);
  });

  // ── 7. Unknown exercise name handling ─────────────────────────

  it("defaults to 'Unknown exercise' when name is missing", async () => {
    claudeReturns(JSON.stringify([
      { weightLbs: 50, sets: 3, reps: 10 },
    ]));

    const result = await parseWorkoutText("something 50lbs 3x10");

    expect(result[0].name).toBe("Unknown exercise");
  });

  it("defaults to 'Unknown exercise' when name is empty string", async () => {
    claudeReturns(JSON.stringify([
      { name: "", weightLbs: 50, sets: 3, reps: 10 },
    ]));

    const result = await parseWorkoutText("something 50lbs 3x10");

    expect(result[0].name).toBe("Unknown exercise");
  });

  it("defaults to 'Unknown exercise' when name is null", async () => {
    claudeReturns(JSON.stringify([
      { name: null, weightLbs: 50, sets: 3, reps: 10 },
    ]));

    const result = await parseWorkoutText("something 50lbs 3x10");

    expect(result[0].name).toBe("Unknown exercise");
  });

  // ── Multiple exercises in a single response ───────────────────

  it("parses multiple exercises from a single response", async () => {
    claudeReturns(JSON.stringify([
      { name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 },
      { name: "Incline Dumbbell Press", weightLbs: 50, sets: 3, reps: 12 },
      { name: "Cable Fly", weightLbs: 25, sets: 4, reps: 15 },
    ]));

    const result = await parseWorkoutText("bench 135 3x10, incline db press 50 3x12, cable fly 25 4x15");

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Bench Press");
    expect(result[1].name).toBe("Incline Dumbbell Press");
    expect(result[2].name).toBe("Cable Fly");
  });

  // ── Empty array from Claude ───────────────────────────────────

  it("returns empty array when Claude returns an empty array", async () => {
    claudeReturns("[]");

    const result = await parseWorkoutText("I didn't work out today");

    expect(result).toEqual([]);
  });
});
