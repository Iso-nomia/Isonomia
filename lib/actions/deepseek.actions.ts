"use server";

export async function generateImage({
  prompt,
  imageSize,
}: {
  prompt: string;
  imageSize: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792" | null;
}) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
    const res = await fetch("https://api.deepseek.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt, n: 1, size: imageSize }),
    });
    if (!res.ok) throw new Error("Deepseek image generation failed");
    const data = await res.json();
    const url = data.data?.[0]?.url as string | undefined;
    if (!url) throw new Error("No image URL found");
    return url;
  } catch (error) {
    console.error("Error generating image:", error);
  }
}
