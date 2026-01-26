"use client";

import { useEffect, useMemo, useState } from "react";
import CodeEditor from "@/components/code-editor";
import { starterCode } from "./starter-code";

type Language = {
  id: number;
  key: string;
  name: string;
};

type RunResult = {
  status: string;
  execTimeMs: number | null;
  memoryKb: number | null;
  output: string | null;
  error: string | null;
  compileOutput: string | null;
};

type CodeTestProps = {
  problemId: number;
  languages: Language[];
};

const formatMemory = (memoryKb: number | null) => {
  if (memoryKb == null) {
    return "-";
  }
  return `${Math.round(memoryKb / 1024)} MB`;
};

const formatTime = (execTimeMs: number | null) => {
  if (execTimeMs == null) {
    return "-";
  }
  return `${execTimeMs} ms`;
};

export default function CodeTest({ problemId, languages }: CodeTestProps) {
  const defaultLanguage = languages[0]?.key ?? "cpp17";
  const [languageKey, setLanguageKey] = useState(defaultLanguage);
  const [code, setCode] = useState(starterCode[defaultLanguage] ?? "");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
    []
  );
  const selectedLanguage = languages.find(
    (language) => language.key === languageKey
  );

  useEffect(() => {
    setCode(starterCode[languageKey] ?? "");
  }, [languageKey]);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${apiBase}/problems/${problemId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          languageKey,
          sourceCode: code,
          input,
        }),
      });

      const payload = (await response.json()) as RunResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Run failed.");
      }
      setResult(payload);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Run failed.");
    } finally {
      setIsRunning(false);
    }
  };

  if (languages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600">
        No languages available. Seed the database to add languages.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Code Test</h2>
            <p className="mt-1 text-sm text-slate-600">
              Run your solution against custom input without submitting.
            </p>
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Language
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-amber-300 focus:outline-none"
                value={languageKey}
                onChange={(event) => setLanguageKey(event.target.value)}
              >
                {languages.map((language) => (
                  <option key={language.key} value={language.key}>
                    {language.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <CodeEditor
            label="Test Code"
            languageLabel={selectedLanguage?.name ?? languageKey}
            value={code}
            onChange={setCode}
            height="280px"
          />

          <CodeEditor
            label="Custom Input"
            languageLabel="stdin"
            value={input}
            onChange={setInput}
            height="160px"
          />
        </div>

        <button
          type="button"
          className="mt-5 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? "Running..." : "Run Code"}
        </button>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-[0.2em] text-slate-500">
                Status
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                {result.status}
              </span>
            </div>
            <div className="grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
              <span>Time: {formatTime(result.execTimeMs)}</span>
              <span>Memory: {formatMemory(result.memoryKb)}</span>
            </div>

            {result.compileOutput ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                <p className="font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Compiler Output
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-mono">
                  {result.compileOutput}
                </pre>
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Output
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-slate-800">
                {result.output || "(no output)"}
              </pre>
            </div>

            {result.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
                <p className="font-semibold uppercase tracking-[0.2em] text-red-700">
                  Error Output
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-mono">
                  {result.error}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
