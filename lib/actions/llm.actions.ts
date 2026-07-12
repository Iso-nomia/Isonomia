"use server";

import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });

export async function runLLMInstruction({ prompt, model = "gpt-3.5-turbo" }: { prompt: string; model?: string }) {
  try {
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });
    return completion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("LLM instruction failed", error);
    return "";
  }
}
