"use client";

import { useCallback, useEffect, useState } from "react";

type BoardMessage = {
  id: number;
  author_name: string;
  body: string;
  created_at: string;
};

type ProblemBoardProps = {
  problemId: number;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ProblemBoard({ problemId }: ProblemBoardProps) {
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}/problems/${problemId}/messages`
      );
      if (!response.ok) {
        throw new Error("Failed to load messages.");
      }
      const payload = (await response.json()) as { messages: BoardMessage[] };
      setMessages(payload.messages ?? []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load messages."
      );
    } finally {
      setIsLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) {
      setError("Message body is required.");
      return;
    }
    setIsPosting(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}/problems/${problemId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            authorName: authorName.trim(),
            body: body.trim(),
          }),
        }
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to post message.");
      }
      setAuthorName("");
      setBody("");
      await loadMessages();
    } catch (postError) {
      setError(
        postError instanceof Error
          ? postError.message
          : "Failed to post message."
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Problem Board</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ask questions, share hints, and discuss edge cases.
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {messages.length} messages
        </span>
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Name
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-amber-300 focus:outline-none"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="Anonymous"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Message
            <textarea
              className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 shadow-sm focus:border-amber-300 focus:outline-none"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPosting}
        >
          {isPosting ? "Posting..." : "Post Message"}
        </button>
      </form>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-600">Loading messages...</p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!isLoading && !error ? (
        messages.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No messages yet. Start the discussion.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {message.author_name}
                  </span>
                  <span>{new Date(message.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {message.body}
                </p>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
