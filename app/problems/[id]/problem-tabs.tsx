"use client";

import { useState } from "react";
import SubmissionForm from "./submission-form";
import SubmissionHistory from "./submission-history";
import ProblemBoard from "./problem-board";
import CodeTest from "./code-test";
import MarkdownPreview from "@/components/markdown-preview";
import LatestVerdict from "./latest-verdict";

type ProblemDetail = {
  id: number;
  slug: string;
  title: string;
  statement: string;
  editorial?: string | null;
  constraints: string | null;
  input_format: string | null;
  output_format: string | null;
  time_limit_ms: number;
  memory_limit_kb: number;
  difficulty: number | null;
  points: number;
};

type SampleCase = {
  id: number;
  name: string | null;
  input: string;
  expected_output: string;
};

type Language = {
  id: number;
  key: string;
  name: string;
};

type ProblemTabsProps = {
  problem: ProblemDetail;
  samples: SampleCase[];
  languages: Language[];
};

const tabs = [
  { id: "verdict", label: "Verdict" },
  { id: "latest", label: "Latest Verdict" },
  { id: "code-test", label: "Code Test" },
  { id: "editorial", label: "Explanation" },
  { id: "submissions", label: "Submissions" },
  { id: "board", label: "Board" },
] as const;

export default function ProblemTabs({
  problem,
  samples,
  languages,
}: ProblemTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>(
    "verdict"
  );
  const [latestSubmissionId, setLatestSubmissionId] = useState<number | null>(
    null
  );

  const handleSubmitted = (submissionId: number) => {
    setLatestSubmissionId(submissionId);
    setActiveTab("latest");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-2 shadow-sm">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
          <span className="rounded-full bg-amber-100 px-3 py-1">
            Problem {problem.id}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
            {problem.points} pts
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {problem.time_limit_ms} ms
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {Math.round(problem.memory_limit_kb / 1024)} MB
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Diff {problem.difficulty ?? "?"}
          </span>
        </div>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {problem.title}
        </h1>
        <MarkdownPreview
          content={problem.statement}
          variant="plain"
          className="text-base text-slate-700"
        />
      </header>

      {activeTab === "verdict" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Problem Details</h2>
            <div className="mt-4 grid gap-4 text-sm text-slate-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Constraints
                </p>
                <MarkdownPreview
                  content={problem.constraints ?? ""}
                  emptyLabel="Not specified."
                  variant="plain"
                  className="text-sm text-slate-700"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Input
                </p>
                <MarkdownPreview
                  content={problem.input_format ?? ""}
                  emptyLabel="Not specified."
                  variant="plain"
                  className="text-sm text-slate-700"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Output
                </p>
                <MarkdownPreview
                  content={problem.output_format ?? ""}
                  emptyLabel="Not specified."
                  variant="plain"
                  className="text-sm text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Samples</h2>
            <div className="mt-4 space-y-4">
              {samples.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No samples registered yet.
                </p>
              ) : (
                samples.map((sample) => (
                  <div key={sample.id} className="grid gap-3">
                    <p className="text-sm font-semibold text-slate-700">
                      {sample.name ?? `Sample ${sample.id}`}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Input
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap text-xs font-mono text-slate-800">
                          {sample.input}
                        </pre>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Output
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap text-xs font-mono text-slate-800">
                          {sample.expected_output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Submit Solution</h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose a language, paste your code, and run the local judge.
            </p>
            <SubmissionForm
              problemId={problem.id}
              languages={languages}
              onSubmitted={handleSubmitted}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-xs text-slate-600">
            The judge runs inside the API container. C++17 and Python 3 are
            available. Add more languages by inserting new rows into the
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">
              languages
            </code>
            table.
          </div>
        </div>
      ) : null}

      {activeTab === "latest" ? (
        <LatestVerdict submissionId={latestSubmissionId} />
      ) : null}

      {activeTab === "editorial" ? (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Explanation</h2>
          <div className="mt-3">
            <MarkdownPreview
              content={problem.editorial ?? ""}
              emptyLabel="No editorial has been published for this problem yet."
              variant="plain"
              className="text-sm text-slate-700"
            />
          </div>
        </div>
      ) : null}

      {activeTab === "submissions" ? (
        <SubmissionHistory problemId={problem.id} />
      ) : null}

      {activeTab === "board" ? (
        <ProblemBoard problemId={problem.id} />
      ) : null}

      {activeTab === "code-test" ? (
        <CodeTest problemId={problem.id} languages={languages} />
      ) : null}
    </div>
  );
}
