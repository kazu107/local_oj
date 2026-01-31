"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

type CodeEditorProps = {
  label: string;
  languageLabel?: string;
  languageKey?: string;
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
};

const LANGUAGE_MAP: Record<string, string> = {
  cpp17: "cpp",
  c11: "c",
  python3: "python",
  java11: "java",
  nodejs: "javascript",
  javascript: "javascript",
  js: "javascript",
  cpp: "cpp",
  c: "c",
  python: "python",
  java: "java",
};

const getMonacoLanguage = (key?: string) => {
  const normalizedKey = key?.toLowerCase() ?? "";
  const mapped = LANGUAGE_MAP[normalizedKey];
  if (mapped) {
    return mapped;
  }
  const stripped = normalizedKey.replace(/\d+$/, "");
  return stripped || "plaintext";
};

export default function CodeEditor({
  label,
  languageLabel,
  languageKey,
  value,
  onChange,
  height = "260px",
  readOnly = false,
}: CodeEditorProps) {
  const language = useMemo(
    () => getMonacoLanguage(languageKey),
    [languageKey]
  );

  return (
    <div className="rounded-2xl border border-slate-800/40 bg-slate-950 text-slate-100 shadow-sm normal-case">
      <div className="flex items-center justify-between border-b border-slate-800/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        <span>{label}</span>
        {languageLabel ? (
          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200">
            {languageLabel}
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-b-2xl">
        <MonacoEditor
          height={height}
          value={value}
          language={language}
          theme="vs-dark"
          onChange={(nextValue) => onChange(nextValue ?? "")}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily:
              "var(--font-geist-mono), SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace",
            lineHeight: 20,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
          loading={
            <div className="px-3 py-3 text-xs text-slate-400">
              Loading editor...
            </div>
          }
        />
      </div>
    </div>
  );
}
