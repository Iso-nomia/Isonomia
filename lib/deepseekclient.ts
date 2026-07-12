import crypto from "crypto";
import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;
const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey,
});

export async function deepseekEmbedding(input: string) {
  if (apiKey) {
    try {
      const completion = await openai.chat.completions.create({
        model: "deepseek-reasoner",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Return a JSON object with a field 'embedding' containing a 32-dimensional array of numbers between -1 and 1.",
          },
          { role: "user", content: input },
        ],
      });
      const message = completion.choices[0]?.message?.content;
      if (message) {
        const data = JSON.parse(message);
        if (Array.isArray(data.embedding)) {
          return data.embedding as number[];
        }
      }
    } catch (err) {
      console.warn("Deepseek embedding failed", err);
    }
  }

  const hash = crypto.createHash("sha256").update(input).digest();
  return Array.from(hash.slice(0, 32)).map((b) => b / 255);
}
