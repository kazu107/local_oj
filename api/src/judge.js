import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

const OUTPUT_LIMIT = 64 * 1024;
const COMPILE_TIMEOUT_MS = 10000;
const TIME_COMMAND_PATH = "/usr/bin/time";

let timeCommandChecked = false;
let cachedTimeCommand = null;

function normalizeCommand(value) {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function fillPlaceholders(args, replacements) {
  return args.map((arg) =>
    arg.replace(/\{(\w+)\}/g, (_, key) => replacements[key] ?? "")
  );
}

function normalizeOutput(text) {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

async function getTimeCommandPath() {
  if (timeCommandChecked) {
    return cachedTimeCommand;
  }
  timeCommandChecked = true;
  if (process.platform === "win32") {
    return null;
  }
  try {
    await fs.access(TIME_COMMAND_PATH);
    cachedTimeCommand = TIME_COMMAND_PATH;
  } catch {
    cachedTimeCommand = null;
  }
  return cachedTimeCommand;
}

function normalizeTestcaseText(text) {
  if (text == null) {
    return "";
  }
  if (text.includes("\n") || text.includes("\r")) {
    return text;
  }
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t");
}

function runProcess(command, args, input, timeoutMs, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < OUTPUT_LIMIT) {
        stdout += chunk.toString("utf8");
      }
    });

    child.stderr.on("data", (chunk) => {
      if (stderr.length < OUTPUT_LIMIT) {
        stderr += chunk.toString("utf8");
      }
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        signal,
        stdout,
        stderr,
        timedOut,
      });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function compileIfNeeded(language, sourcePath, exePath, workDir) {
  const compileTemplate = normalizeCommand(language.compile_command);
  if (!compileTemplate) {
    return { ok: true, output: null };
  }

  const compileArgs = fillPlaceholders(compileTemplate, {
    src: sourcePath,
    exe: exePath,
    workdir: workDir,
  });
  const [command, ...args] = compileArgs;

  const result = await runProcess(
    command,
    args,
    null,
    COMPILE_TIMEOUT_MS,
    workDir
  );

  if (result.timedOut || result.exitCode !== 0) {
    return {
      ok: false,
      output: `${result.stdout}${result.stderr}`.trim(),
    };
  }

  return { ok: true, output: `${result.stdout}${result.stderr}`.trim() || null };
}

async function executeProgram({
  language,
  sourcePath,
  exePath,
  workDir,
  input,
  timeoutMs,
  memoryLimitKb,
}) {
  const runTemplate = normalizeCommand(language.run_command);
  if (!runTemplate) {
    return {
      status: "System Error",
      execTimeMs: null,
      output: null,
      error: "Run command not configured.",
      memoryKb: null,
    };
  }

  const runArgs = fillPlaceholders(runTemplate, {
    src: sourcePath,
    exe: exePath,
    workdir: workDir,
  });
  let command = runArgs[0];
  let args = runArgs.slice(1);
  const timeCommand = await getTimeCommandPath();
  let timeFile = null;

  if (timeCommand) {
    timeFile = path.join(
      workDir,
      `time-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    );
    args = ["-o", timeFile, "-f", "%M", command, ...args];
    command = timeCommand;
  }

  const start = Date.now();
  const result = await runProcess(
    command,
    args,
    input,
    timeoutMs,
    workDir
  );
  const execTimeMs = Date.now() - start;
  let memoryKb = null;

  if (timeFile) {
    try {
      const content = await fs.readFile(timeFile, "utf8");
      const parsed = Number.parseInt(content.trim(), 10);
      if (Number.isFinite(parsed)) {
        memoryKb = parsed;
      }
    } catch {
      memoryKb = null;
    } finally {
      await fs.rm(timeFile, { force: true });
    }
  }

  if (result.timedOut) {
    return {
      status: "Time Limit Exceeded",
      execTimeMs,
      memoryKb,
      output: result.stdout.trim(),
      error: result.stderr.trim() || null,
    };
  }

  if (result.exitCode !== 0) {
    return {
      status: "Runtime Error",
      execTimeMs,
      memoryKb,
      output: result.stdout.trim(),
      error: result.stderr.trim() || null,
    };
  }

  if (memoryLimitKb != null && memoryKb != null && memoryKb > memoryLimitKb) {
    return {
      status: "Memory Limit Exceeded",
      execTimeMs,
      memoryKb,
      output: result.stdout.trim() || null,
      error: result.stderr.trim() || null,
    };
  }

  return {
    status: "OK",
    execTimeMs,
    memoryKb,
    output: result.stdout.trim() || null,
    error: result.stderr.trim() || null,
  };
}

async function runTestcase(
  language,
  sourcePath,
  exePath,
  workDir,
  testcase,
  timeoutMs,
  memoryLimitKb
) {
  const input = normalizeTestcaseText(testcase.input);
  const execResult = await executeProgram({
    language,
    sourcePath,
    exePath,
    workDir,
    input,
    timeoutMs,
    memoryLimitKb,
  });

  if (execResult.status !== "OK") {
    return execResult;
  }

  const expected = normalizeOutput(
    normalizeTestcaseText(testcase.expected_output)
  );
  const actual = normalizeOutput(execResult.output ?? "");
  const status = actual === expected ? "Accepted" : "Wrong Answer";

  return {
    status,
    execTimeMs: execResult.execTimeMs,
    memoryKb: execResult.memoryKb,
    output: execResult.output,
    error: execResult.error,
  };
}

export async function judgeSubmission({
  language,
  problem,
  testcases,
  sourceCode,
}) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "oj-"));
  const sourcePath = path.join(workDir, `Main.${language.source_ext}`);
  const exePath = path.join(workDir, "main");

  try {
    await fs.writeFile(sourcePath, sourceCode, "utf8");

    const compileResult = await compileIfNeeded(
      language,
      sourcePath,
      exePath,
      workDir
    );

    if (!compileResult.ok) {
      return {
        verdict: "Compilation Error",
        compileOutput: compileResult.output,
        results: [],
        maxTimeMs: null,
        maxMemoryKb: null,
      };
    }

    const timeoutMs =
      problem.time_limit_ms || language.default_time_limit_ms || 2000;
    const memoryLimitKb =
      problem.memory_limit_kb ?? language.default_memory_limit_kb ?? null;

    const results = [];
    for (const testcase of testcases) {
      const result = await runTestcase(
        language,
        sourcePath,
        exePath,
        workDir,
        testcase,
        timeoutMs,
        memoryLimitKb
      );
      results.push({
        testcaseId: testcase.id,
        name: testcase.name,
        ...result,
      });
    }

    const verdict =
      results.find((item) => item.status !== "Accepted")?.status ??
      "Accepted";

    const maxTimeMs = results.reduce((max, item) => {
      if (!item.execTimeMs) {
        return max;
      }
      return Math.max(max, item.execTimeMs);
    }, 0);
    const maxMemoryKb = results.reduce((max, item) => {
      if (item.memoryKb == null) {
        return max;
      }
      if (max == null || item.memoryKb > max) {
        return item.memoryKb;
      }
      return max;
    }, null);

    return {
      verdict,
      compileOutput: compileResult.output,
      results,
      maxTimeMs,
      maxMemoryKb,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export async function runCode({ language, problem, sourceCode, input }) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "oj-"));
  const sourcePath = path.join(workDir, `Main.${language.source_ext}`);
  const exePath = path.join(workDir, "main");

  try {
    await fs.writeFile(sourcePath, sourceCode, "utf8");

    const compileResult = await compileIfNeeded(
      language,
      sourcePath,
      exePath,
      workDir
    );

    if (!compileResult.ok) {
      return {
        status: "Compilation Error",
        compileOutput: compileResult.output,
        execTimeMs: null,
        memoryKb: null,
        output: null,
        error: null,
      };
    }

    const timeoutMs =
      problem.time_limit_ms || language.default_time_limit_ms || 2000;
    const memoryLimitKb =
      problem.memory_limit_kb ?? language.default_memory_limit_kb ?? null;

    const execResult = await executeProgram({
      language,
      sourcePath,
      exePath,
      workDir,
      input: normalizeTestcaseText(input ?? ""),
      timeoutMs,
      memoryLimitKb,
    });

    return {
      status: execResult.status === "OK" ? "Ran" : execResult.status,
      compileOutput: compileResult.output,
      execTimeMs: execResult.execTimeMs,
      memoryKb: execResult.memoryKb,
      output: execResult.output,
      error: execResult.error,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
