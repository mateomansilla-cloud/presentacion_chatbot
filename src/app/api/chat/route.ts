import OpenAI from "openai";
import { NextResponse } from "next/server";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

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

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const reply = response.output_text?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: "No se recibio texto de respuesta del modelo." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado en /api/chat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
