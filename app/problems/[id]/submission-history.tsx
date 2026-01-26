"use client";

import { Fragment, useEffect, useState } from "react";

type SubmissionSummary = {
  id: number;
  status: string;
  verdict: string | null;
  exec_time_ms: number | null;
  memory_kb: number | null;
  code_length: number | null;
  source_code: string;
  created_at: string;
  language_name: string;
};

type SubmissionHistoryProps = {
  problemId: number;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatMemory(memoryKb: number | null) {
  if (!memoryKb) {
    return "-";
  }
  return `${Math.round(memoryKb / 1024)} MB`;
}

function formatTime(execTimeMs: number | null) {
  if (execTimeMs == null) {
    return "-";
  }
  return `${execTimeMs} ms`;
}

export default function SubmissionHistory({ problemId }: SubmissionHistoryProps) {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    let isActive = true;

    const fetchSubmissions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${apiBase}/problems/${problemId}/submissions`
        );
        if (!response.ok) {
          throw new Error("Failed to load submissions.");
        }
        const payload = (await response.json()) as {
          submissions: SubmissionSummary[];
        };
        if (isActive) {
          setSubmissions(payload.submissions ?? []);
        }
      } catch (fetchError) {
        if (isActive) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load submissions."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchSubmissions();

    return () => {
      isActive = false;
    };
  }, [problemId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Submission History</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {submissions.length} submissions
        </span>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-600">Loading submissions...</p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!isLoading && !error ? (
        submissions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No submissions yet. Submit a solution to see history.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-700">
              <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Verdict</th>
                  <th className="py-2 pr-4">Language</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Memory</th>
                  <th className="py-2 pr-4">Submitted</th>
                  <th className="py-2 pr-2 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {submissions.map((submission) => {
                  const isExpanded = expandedIds.has(submission.id);
                  return (
                    <Fragment key={submission.id}>
                      <tr>
                        <td className="py-3 pr-4 font-semibold">
                          {submission.id}
                        </td>
                        <td className="py-3 pr-4">
                          {submission.verdict ?? submission.status}
                        </td>
                        <td className="py-3 pr-4">
                          {submission.language_name}
                        </td>
                        <td className="py-3 pr-4">
                          {submission.code_length != null
                            ? `${submission.code_length} chars`
                            : "-"}
                        </td>
                        <td className="py-3 pr-4">
                          {formatTime(submission.exec_time_ms)}
                        </td>
                        <td className="py-3 pr-4">
                          {formatMemory(submission.memory_kb)}
                        </td>
                        <td className="py-3 pr-4">
                          {new Date(submission.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-amber-200 hover:text-slate-900"
                            onClick={() => toggleExpanded(submission.id)}
                            aria-label="Toggle code"
                          >
                            {isExpanded ? "▾" : "▸"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td className="py-3 pr-2" colSpan={8}>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-800">
                                {submission.source_code}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
