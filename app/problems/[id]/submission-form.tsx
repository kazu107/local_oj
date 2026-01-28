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
  status: string;
  codeLength: number;
};

type SubmissionFormProps = {
  problemId: number;
  languages: Language[];
  onSubmitted?: (submissionId: number) => void;
};

export default function SubmissionForm({
  problemId,
  languages,
  onSubmitted,
}: SubmissionFormProps) {
  const defaultLanguage = languages[0]?.key ?? "cpp17";
  const [languageKey, setLanguageKey] = useState(defaultLanguage);
  const [code, setCode] = useState(starterCode[defaultLanguage] ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      onSubmitted?.(payload.submissionId);
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
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="font-semibold uppercase tracking-[0.2em] text-slate-500">
            Submission received
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Submission #{result.submissionId} is judging. Open the Latest Verdict
            tab to watch results appear.
          </p>
        </div>
      ) : null}
    </form>
  );
}
