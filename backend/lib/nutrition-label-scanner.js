import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function scanNutritionLabel(imageBase64, mediaType) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: `You extract nutrition facts from food label photos.
Return ONLY valid JSON — no markdown, no code fences.
Format: {"name":"Product Name","brand":"Brand if visible","servingSize":28,"servingUnit":"g","calories":150,"proteinG":5,"carbsG":20,"fatG":7}

Rules:
- Extract the product name and brand from the label if visible
- servingSize should be the numeric value from the serving size line
- servingUnit should be the unit (g, oz, ml, piece, cup, etc.)
- All nutrient values should be per ONE serving
- If a value is not visible or unclear, use 0
- Return the most accurate values you can read from the label`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Extract the nutrition facts from this food label.",
          },
        ],
      },
    ],
  });

  const raw = response.content[0].text;
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      name: parsed.name || "",
      brand: parsed.brand || null,
      servingSize: parsed.servingSize || 0,
      servingUnit: parsed.servingUnit || "g",
      calories: parsed.calories || 0,
      proteinG: parsed.proteinG || 0,
      carbsG: parsed.carbsG || 0,
      fatG: parsed.fatG || 0,
    };
  } catch {
    throw new Error("Failed to parse nutrition label data from image");
  }
}
