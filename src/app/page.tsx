"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatApiResponse = {
  reply?: string;
  error?: string;
  mode?: "slide" | "text";
  slideIndex?: number | null;
  sectionIndex?: number | null;
  slideTitle?: string | null;
};

type SlideWindow = Window & {
  go?: (index: number) => void;
  openDetail?: (section?: number) => void;
};

type SlideAction = {
  slideIndex: number;
  sectionIndex: number | null;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now() + Math.random());
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [queuedAction, setQueuedAction] = useState<SlideAction | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const runSlideAction = (action: SlideAction) => {
    const win = iframeRef.current?.contentWindow as SlideWindow | null;
    if (!win || typeof win.go !== "function") return false;

    win.go(action.slideIndex);
    if (
      action.sectionIndex !== null &&
      typeof win.openDetail === "function"
    ) {
      window.setTimeout(() => win.openDetail?.(action.sectionIndex ?? undefined), 240);
    }
    return true;
  };

  useEffect(() => {
    if (!queuedAction || !iframeLoaded) return;
    const ok = runSlideAction(queuedAction);
    if (ok) {
      window.setTimeout(() => setQueuedAction(null), 0);
    }
  }, [iframeLoaded, queuedAction]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const question = input.trim();
    if (!question || isLoading) return;
    if (showIntro) setShowIntro(false);

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: question,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = (await response.json()) as ChatApiResponse;
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "No se pudo obtener respuesta.");
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: data.reply,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.mode === "slide" && typeof data.slideIndex === "number") {
        const action: SlideAction = {
          slideIndex: data.slideIndex,
          sectionIndex:
            typeof data.sectionIndex === "number" ? data.sectionIndex : null,
        };

        if (!runSlideAction(action)) {
          setQueuedAction(action);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100">
      <main className="grid h-full w-full grid-cols-1 lg:grid-cols-[420px_1fr]">
        <section className="flex h-full min-h-0 flex-col border-r border-slate-700/60 bg-slate-900">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="rounded-lg bg-slate-800 p-3 text-sm text-slate-300">
                Hace una pregunta para comenzar.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "ml-auto bg-cyan-500/20 text-cyan-100"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {message.content}
                </div>
              ))
            )}

            {isLoading ? (
              <p className="text-xs text-slate-400">Procesando...</p>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t border-slate-700/60 p-4">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribi tu pregunta..."
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-600 bg-slate-950 p-3 text-sm text-white outline-none ring-cyan-400/40 transition focus:ring-2"
            />
            {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-3 w-full rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Enviar
            </button>
          </form>
        </section>

        <section className="h-full w-full">
          <div className="relative h-full w-full">
            <iframe
              ref={iframeRef}
              src="/slides.html"
              title="Presentacion"
              onLoad={() => setIframeLoaded(true)}
              className="h-full w-full border-0"
            />

            {showIntro ? (
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/60 p-6">
                <div className="w-full max-w-2xl rounded-3xl border border-cyan-300/25 bg-slate-900/70 p-8 text-slate-100 shadow-2xl backdrop-blur-lg">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                    Area de IA
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
                    Chatbot Ejecutivo
                  </h1>
                  <p className="mt-4 text-base text-slate-200 sm:text-lg">
                    Hola. Soy el asistente del area de Inteligencia Artificial.
                  </p>
                  <p className="mt-2 text-base text-slate-300 sm:text-lg">
                    Que te gustaria saber hoy?
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowIntro(false)}
                    className="mt-8 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Comenzar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
