import Link from "next/link";
import { getApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";

type ProblemSummary = {
  id: number;
  slug: string;
  title: string;
  difficulty: number | null;
  time_limit_ms: number;
  memory_limit_kb: number;
  points: number;
};

async function fetchProblems(): Promise<ProblemSummary[]> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/problems`, { cache: "no-store" });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { problems: ProblemSummary[] };
  return data.problems ?? [];
}

export default async function Home() {
  const problems = await fetchProblems();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-14">
        <header className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-700 shadow-sm">
            OJ V2
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Practice arena with a built-in judge and PostgreSQL backbone.
          </h1>
          <p className="max-w-2xl text-base text-slate-700 sm:text-lg">
            Browse problems, submit solutions in C++ or Python, and get feedback
            from the local judge. This is a minimal prototype meant to grow.
          </p>
        </header>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Problem Set</h2>
              <span className="text-sm text-slate-600">
                {problems.length} problems available
              </span>
            </div>
            <Link
              href="/problems/new"
              className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-sm transition hover:border-amber-300 hover:text-amber-700"
            >
              Create Problem
            </Link>
          </div>
          <div className="grid gap-4">
            {problems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-600">
                No problems found. Make sure the API and database are running.
              </div>
            ) : (
              problems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/problems/${problem.id}`}
                  className="group rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-lg"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Problem {problem.id}
                      </p>
                      <h3 className="text-xl font-semibold text-slate-900">
                        {problem.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                        {problem.points} pts
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1">
                        Diff {problem.difficulty ?? "?"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        {problem.time_limit_ms} ms
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        {Math.round(problem.memory_limit_kb / 1024)} MB
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Open the statement, read samples, and submit your solution.
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
