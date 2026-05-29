"use client";

import { FormEvent, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const question = input.trim();
    if (!question || isLoading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "No se pudo obtener respuesta.");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply as string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-6 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Demo IA</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Presentacion Chatbot</h1>
          <p className="mt-2 text-sm text-slate-300">
            Hace una pregunta y el asistente responde desde tu API de OpenAI.
          </p>
        </header>

        <section className="flex-1 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 sm:p-6">
          <div className="mb-4 h-[52vh] space-y-3 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-950/60 p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400">
                Escribi la primera pregunta para comenzar la demo.
              </p>
            ) : (
              messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`max-w-[90%] rounded-xl px-4 py-3 text-sm sm:text-base ${
                    message.role === "user"
                      ? "ml-auto bg-cyan-500/20 text-cyan-100"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {message.content}
                </article>
              ))
            )}
            {isLoading && (
              <p className="text-sm text-slate-400">Pensando respuesta...</p>
            )}
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribi tu pregunta..."
              className="w-full resize-none rounded-xl border border-slate-600 bg-slate-950/70 p-3 text-sm text-slate-100 outline-none ring-cyan-400/40 transition focus:ring-2 sm:text-base"
              rows={3}
            />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isLoading ? "Consultando..." : "Preguntar"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
