"use client";

import { useMemo, useRef } from "react";

type CodeEditorProps = {
  label: string;
  languageLabel?: string;
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
};

export default function CodeEditor({
  label,
  languageLabel,
  value,
  onChange,
  height = "260px",
  readOnly = false,
}: CodeEditorProps) {
  const lineNumbersRef = useRef<HTMLPreElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const lineNumbers = useMemo(() => {
    const lines = Math.max(1, value.split("\n").length);
    return Array.from({ length: lines }, (_, index) => index + 1).join("\n");
  }, [value]);

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/40 bg-slate-950 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        <span>{label}</span>
        {languageLabel ? (
          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200">
            {languageLabel}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-[auto_1fr]">
        <pre
          ref={lineNumbersRef}
          className="select-none border-r border-slate-800/50 px-3 py-3 text-right text-[11px] leading-5 text-slate-500"
        >
          {lineNumbers}
        </pre>
        <textarea
          ref={textareaRef}
          className="min-h-[120px] w-full resize-none bg-transparent px-3 py-3 font-mono text-xs leading-5 text-slate-100 outline-none"
          style={{ minHeight: height, tabSize: 2 }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
