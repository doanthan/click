import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { internalApiNotFound } from "@/lib/runtime-mode";
import {
  buildStagePrompt,
  type StagePromptOptions,
} from "@/lib/stage-image-gen";

// Atmospheric email-stage generation for /test-stage. One image is returned
// per request. Paired mode calls this route once for the hero, then again with
// that hero supplied as the closing image's world reference.

export const runtime = "nodejs";
export const maxDuration = 300;

const MODELS = {
  flash: "gemini-3.1-flash-image-preview",
  pro: "gemini-3-pro-image-preview",
} as const;

const ASPECTS = {
  hero: "4:5",
  closer: "3:2",
} as const;

const ATTEMPT_TIMEOUT_MS = 120_000;
const RETRY_BACKOFF_MS = 3_000;
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

type GeminiReply = { status: number; ok: boolean; body: string };
type ImageReference = { mimeType: string; data: string };
type RequestBody = StagePromptOptions & {
  model?: string;
  productReference?: string;
  worldReference?: string;
};

async function callGemini(url: string, payload: unknown): Promise<GeminiReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return {
      status: response.status,
      ok: response.ok,
      body: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseImageReference(value: unknown): ImageReference | null {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;

  const data = match[2];
  const approximateBytes = Math.floor((data.length * 3) / 4);
  if (approximateBytes > MAX_REFERENCE_BYTES) return null;
  return { mimeType: match[1], data };
}

export async function POST(request: Request) {
  const unavailable = internalApiNotFound();
  if (unavailable) return unavailable;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const limit = await checkRateLimit({
    scope: "stage-image-generation",
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

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const placement = body.placement === "closer" ? "closer" : "hero";
  const productReference = parseImageReference(body.productReference);
  const worldReference = parseImageReference(body.worldReference);
  if (body.productReference && !productReference) {
    return NextResponse.json(
      { error: "The product reference must be a JPG, PNG or WebP under 8 MB." },
      { status: 400 },
    );
  }
  if (body.worldReference && !worldReference) {
    return NextResponse.json(
      { error: "The world reference must be a JPG, PNG or WebP under 8 MB." },
      { status: 400 },
    );
  }

  const prompt = buildStagePrompt({
    ...body,
    placement,
    hasProductReference: !!productReference,
    hasWorldReference: !!worldReference,
  });
  const model = body.model === "pro" ? MODELS.pro : MODELS.flash;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [{ text: prompt }];
  if (productReference) {
    parts.push({ text: "PRODUCT REFERENCE IMAGE" });
    parts.push({ inlineData: productReference });
  }
  if (worldReference) {
    parts.push({ text: "PAIRED HERO WORLD REFERENCE IMAGE" });
    parts.push({ inlineData: worldReference });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.93,
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: ASPECTS[placement] },
    },
  };

  let reply: GeminiReply;
  try {
    reply = await callGemini(url, payload);
    if (reply.status === 503 || reply.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
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
      content?: {
        parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
      };
    }>;
  } | null = null;
  try {
    data = JSON.parse(reply.body);
  } catch {
    // Fall through to the no-image response below.
  }

  const responseParts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = responseParts.find((part) => part.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    return NextResponse.json(
      { error: "The model returned no image - try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    image: `data:${inline.mimeType || "image/png"};base64,${inline.data}`,
  });
}
