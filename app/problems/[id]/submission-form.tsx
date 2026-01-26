"use client";

import { useEffect, useMemo, useState } from "react";
import CodeEditor from "@/components/code-editor";
import { starterCode } from "./starter-code";

type Language = {
  id: number;
  key: string;
  name: string;
};

type JudgeResult = {
  submissionId: number;
  verdict: string;
  compilerOutput?: string | null;
  codeLength: number;
  results: Array<{
    testcaseId: number;
    name: string | null;
    status: string;
    execTimeMs: number | null;
    memoryKb: number | null;
    output?: string | null;
    error?: string | null;
  }>;
};

type SubmissionFormProps = {
  problemId: number;
  languages: Language[];
};

export default function SubmissionForm({
  problemId,
  languages,
}: SubmissionFormProps) {
  const defaultLanguage = languages[0]?.key ?? "cpp17";
  const [languageKey, setLanguageKey] = useState(defaultLanguage);
  const [code, setCode] = useState(starterCode[defaultLanguage] ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const displayCodeLength = result?.codeLength ?? code.length;
  const selectedLanguage = languages.find(
    (language) => language.key === languageKey
  );

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
    []
  );

  useEffect(() => {
    setCode(starterCode[languageKey] ?? "");
  }, [languageKey]);

  if (languages.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
        No languages available. Seed the database to add languages.
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${apiBase}/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          problemId,
          languageKey,
          sourceCode: code,
        }),
      });

      const payload = (await response.json()) as JudgeResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Submission failed.");
      }

      setResult(payload);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Submission failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
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

      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Source Code
        <div className="mt-3">
          <CodeEditor
            label="Submission Code"
            languageLabel={selectedLanguage?.name ?? languageKey}
            value={code}
            onChange={setCode}
          />
        </div>
      </label>

      <button
        type="submit"
        className="w-full rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Judging..." : "Run Judge"}
      </button>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold uppercase tracking-[0.2em] text-slate-500">
              Verdict
            </span>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {result.verdict}
            </span>
          </div>

          {result.compilerOutput ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              <p className="font-semibold uppercase tracking-[0.2em] text-amber-700">
                Compiler Output
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-mono">
                {result.compilerOutput}
              </pre>
            </div>
          ) : null}

          <div className="grid gap-2">
            {result.results.map((caseResult) => (
              <div
                key={caseResult.testcaseId}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {caseResult.name ?? `Case ${caseResult.testcaseId}`}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {caseResult.status}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
                  <span>Result: {caseResult.status}</span>
                  <span>Code length: {displayCodeLength} chars</span>
                  <span>Time: {caseResult.execTimeMs ?? "-"} ms</span>
                  <span>
                    Memory:{" "}
                    {caseResult.memoryKb != null
                      ? `${Math.round(caseResult.memoryKb / 1024)} MB`
                      : "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
