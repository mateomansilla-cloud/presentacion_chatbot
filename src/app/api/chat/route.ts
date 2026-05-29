import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { NextResponse } from "next/server";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type SlideCatalogItem = {
  index: number;
  title: string;
  short: string;
  type: string;
  summary: string;
  sections: string[];
  projects: Array<{ name: string; go: number }>;
};

type PlannerDecision = {
  mode: "slide" | "text";
  answer: string;
  slideIndex: number | null;
  sectionIndex: number | null;
};

const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const botDirectory = path.join(process.cwd(), "bot");

async function readBotFile(fileName: string) {
  const filePath = path.join(botDirectory, fileName);
  try {
    const content = await readFile(filePath, "utf-8");
    return content.trim();
  } catch {
    return "";
  }
}

async function readSlidesCatalog() {
  const raw = await readBotFile("slides-catalog.json");
  if (!raw) return [] as SlideCatalogItem[];

  try {
    const parsed = JSON.parse(raw) as SlideCatalogItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as SlideCatalogItem[];
  }
}

function parseDecision(raw: string): PlannerDecision | null {
  try {
    return JSON.parse(raw) as PlannerDecision;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0 || end <= start) return null;

    try {
      return JSON.parse(raw.slice(start, end + 1)) as PlannerDecision;
    } catch {
      return null;
    }
  }
}

function sanitizeDecision(
  decision: PlannerDecision | null,
  slidesCount: number,
): PlannerDecision {
  if (!decision) {
    return {
      mode: "text",
      answer: "No pude decidir la vista visual, asi que respondo en texto.",
      slideIndex: null,
      sectionIndex: null,
    };
  }

  const mode = decision.mode === "slide" ? "slide" : "text";
  const answer = String(decision.answer ?? "").trim();

  const slideIndex =
    typeof decision.slideIndex === "number" &&
    Number.isInteger(decision.slideIndex) &&
    decision.slideIndex >= 0 &&
    decision.slideIndex < slidesCount
      ? decision.slideIndex
      : null;

  const sectionIndex =
    typeof decision.sectionIndex === "number" &&
    Number.isInteger(decision.sectionIndex) &&
    decision.sectionIndex >= 0
      ? decision.sectionIndex
      : null;

  if (mode === "slide" && slideIndex === null) {
    return {
      mode: "text",
      answer: answer || "No encontre una slide exacta para esa pregunta.",
      slideIndex: null,
      sectionIndex: null,
    };
  }

  return {
    mode,
    answer:
      answer ||
      (mode === "slide"
        ? "Te muestro la slide mas relevante para esta pregunta."
        : "No hay slide exacta para esto; te respondo con el contexto disponible."),
    slideIndex,
    sectionIndex,
  };
}

async function loadInstructions() {
  const [systemPrompt, projectContexts, slidesCatalog] = await Promise.all([
    readBotFile("system-prompt.md"),
    readBotFile("project-contexts.md"),
    readSlidesCatalog(),
  ]);

  const sections = [
    systemPrompt ? `SYSTEM PROMPT\n${systemPrompt}` : "",
    projectContexts ? `PROJECT CONTEXTS\n${projectContexts}` : "",
    slidesCatalog.length
      ? `SLIDES CATALOG\n${JSON.stringify(slidesCatalog, null, 2)}`
      : "",
  ].filter(Boolean);

  return {
    instructions: sections.join("\n\n"),
    slidesCatalog,
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar OPENAI_API_KEY en el entorno." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { messages?: Message[] };
    const messages = body.messages ?? [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Debes enviar al menos un mensaje." },
        { status: 400 },
      );
    }

    const { instructions, slidesCatalog } = await loadInstructions();
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      instructions: `
${instructions}

Tu objetivo es decidir si la pregunta debe mostrarse con una slide o con respuesta de texto.

Reglas:
- Usa mode="slide" solo si hay una slide claramente adecuada.
- Si no hay una slide exacta, usa mode="text".
- Si mode="text", responde usando solo la informacion de PROJECT CONTEXTS.
- Si falta informacion, decilo explicitamente.
- Escribi respuestas en espanol, tono ejecutivo, breve y claro.

Devuelve SOLO JSON valido (sin markdown) con este esquema exacto:
{
  "mode": "slide" | "text",
  "answer": "string",
  "slideIndex": number | null,
  "sectionIndex": number | null
}
`,
      input: messages.slice(-10).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const raw = response.output_text?.trim();
    if (!raw) {
      return NextResponse.json(
        { error: "No se recibio contenido del modelo." },
        { status: 502 },
      );
    }

    const parsed = parseDecision(raw);
    const decision = sanitizeDecision(parsed, slidesCatalog.length);
    const slideTitle =
      decision.slideIndex !== null
        ? slidesCatalog[decision.slideIndex]?.title ?? null
        : null;

    return NextResponse.json({
      reply: decision.answer,
      mode: decision.mode,
      slideIndex: decision.slideIndex,
      sectionIndex: decision.sectionIndex,
      slideTitle,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado en /api/chat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
