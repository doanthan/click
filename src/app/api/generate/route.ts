import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildPrompt, type PromptOptions } from "@/lib/image-gen";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { internalApiNotFound } from "@/lib/runtime-mode";

// Candid event image generation (backs /images). One image per request; the
// client fires N concurrent POSTs for a batch. Key stays server-side.

export const runtime = "nodejs";
export const maxDuration = 300; // one 120s attempt + 3s backoff + one retry

const MODELS = {
  flash: "gemini-3.1-flash-image-preview",
  pro: "gemini-3-pro-image-preview",
} as const;

const ASPECTS = new Set(["1:1", "4:5", "3:2"]);
const ATTEMPT_TIMEOUT_MS = 120_000;
const RETRY_BACKOFF_MS = 3_000;

type GeminiReply = { status: number; ok: boolean; body: string };

async function callGemini(url: string, payload: unknown): Promise<GeminiReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    // Read the body while the timer is still armed - fetch resolves at
    // headers, and a stalled multi-MB body must also hit the 120s ceiling.
    return { status: res.status, ok: res.ok, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const unavailable = internalApiNotFound();
  if (unavailable) return unavailable;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const limit = await checkRateLimit({
    scope: "image-generation",
    identity: session.user.email ?? "authenticated-user",
    limit: 12,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Image generation is not configured (GOOGLE_AI_API_KEY missing)." },
      { status: 503 },
    );
  }

  let body: PromptOptions & { aspect?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = buildPrompt(body);
  const model = body.model === "pro" ? MODELS.pro : MODELS.flash;
  const aspectRatio =
    typeof body.aspect === "string" && ASPECTS.has(body.aspect) ? body.aspect : "4:5";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.95,
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio },
    },
  };

  let reply: GeminiReply;
  try {
    reply = await callGemini(url, payload);
    if (reply.status === 503 || reply.status === 429) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      reply = await callGemini(url, payload);
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Generation timed out after 120s." : "Could not reach the image API." },
      { status: aborted ? 504 : 502 },
    );
  }

  if (!reply.ok) {
    const detail = reply.body.slice(0, 300);
    return NextResponse.json(
      { error: `Image API error ${reply.status}${detail ? `: ${detail}` : ""}` },
      { status: 502 },
    );
  }

  let data: {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  } | null = null;
  try {
    data = JSON.parse(reply.body);
  } catch {
    // fall through to the no-image error below
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    return NextResponse.json(
      { error: "The model returned no image - try again." },
      { status: 502 },
    );
  }

  // ponytail: the composed prompt stays server-side on purpose - the directive
  // texts are the product; the client only ever needs the image.
  return NextResponse.json({
    image: `data:${inline.mimeType || "image/png"};base64,${inline.data}`,
  });
}
