import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/api";
import ProblemTabs from "./problem-tabs";

export const dynamic = "force-dynamic";

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

async function fetchProblem(id: string) {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/problems/${id}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as {
    problem: ProblemDetail;
    samples: SampleCase[];
  };
  return data;
}

async function fetchLanguages(): Promise<Language[]> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/languages`, { cache: "no-store" });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { languages: Language[] };
  return data.languages ?? [];
}

export default async function ProblemPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const problemId = resolvedParams.id;
  const [problemPayload, languages] = await Promise.all([
    fetchProblem(problemId),
    fetchLanguages(),
  ]);

  if (!problemPayload) {
    notFound();
  }

  const { problem, samples } = problemPayload;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700"
        >
          Back to problem list
        </Link>

        <ProblemTabs
          problem={problem}
          samples={samples}
          languages={languages}
        />
      </div>
    </div>
  );
}
