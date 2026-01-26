import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { judgeSubmission, runCode } from "./judge.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "512kb" }));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(500).json({ status: "error", error: "database unavailable" });
  }
});

app.get("/languages", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, key, name
       FROM languages
       WHERE enabled = TRUE
       ORDER BY sort_order, id`
    );
    res.json({ languages: rows });
  } catch {
    res.status(500).json({ error: "Failed to load languages." });
  }
});

app.get("/problems", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, title, difficulty, time_limit_ms, memory_limit_kb
       FROM problems
       WHERE is_visible = TRUE
       ORDER BY id`
    );
    res.json({ problems: rows });
  } catch {
    res.status(500).json({ error: "Failed to load problems." });
  }
});

app.get("/problems/:id", async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);

  try {
    const problemResult = await pool.query(
      `SELECT id, slug, title, statement, editorial, constraints, input_format, output_format,
              time_limit_ms, memory_limit_kb, difficulty
       FROM problems
       WHERE ${isNumeric ? "id" : "slug"} = $1
       LIMIT 1`,
      [id]
    );

    if (problemResult.rows.length === 0) {
      res.status(404).json({ error: "Problem not found." });
      return;
    }

    const problem = problemResult.rows[0];

    const samplesResult = await pool.query(
      `SELECT id, name, input, expected_output
       FROM testcases
       WHERE problem_id = $1 AND is_sample = TRUE
       ORDER BY sort_order, id`,
      [problem.id]
    );

    res.json({ problem, samples: samplesResult.rows });
  } catch {
    res.status(500).json({ error: "Failed to load problem." });
  }
});

app.get("/problems/:id/submissions", async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);

  try {
    const problemResult = await pool.query(
      `SELECT id
       FROM problems
       WHERE ${isNumeric ? "id" : "slug"} = $1
       LIMIT 1`,
      [id]
    );

    if (problemResult.rows.length === 0) {
      res.status(404).json({ error: "Problem not found." });
      return;
    }

    const problemId = problemResult.rows[0].id;
    const { rows } = await pool.query(
      `SELECT s.id,
              s.status,
              s.verdict,
              s.exec_time_ms,
              s.memory_kb,
              s.source_code,
              length(s.source_code) AS code_length,
              s.created_at,
              l.name AS language_name
       FROM submissions s
       JOIN languages l ON l.id = s.language_id
       WHERE s.problem_id = $1
       ORDER BY s.id DESC
       LIMIT 50`,
      [problemId]
    );

    res.json({ submissions: rows });
  } catch {
    res.status(500).json({ error: "Failed to load submissions." });
  }
});

app.get("/problems/:id/messages", async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);

  try {
    const problemResult = await pool.query(
      `SELECT id
       FROM problems
       WHERE ${isNumeric ? "id" : "slug"} = $1
       LIMIT 1`,
      [id]
    );

    if (problemResult.rows.length === 0) {
      res.status(404).json({ error: "Problem not found." });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, author_name, body, created_at
       FROM problem_messages
       WHERE problem_id = $1
       ORDER BY id DESC`,
      [problemResult.rows[0].id]
    );

    res.json({ messages: rows });
  } catch {
    res.status(500).json({ error: "Failed to load messages." });
  }
});

app.post("/problems/:id/messages", async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);
  const { authorName, body } = req.body || {};

  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "Message body is required." });
    return;
  }

  try {
    const problemResult = await pool.query(
      `SELECT id
       FROM problems
       WHERE ${isNumeric ? "id" : "slug"} = $1
       LIMIT 1`,
      [id]
    );

    if (problemResult.rows.length === 0) {
      res.status(404).json({ error: "Problem not found." });
      return;
    }

    const name =
      typeof authorName === "string" && authorName.trim()
        ? authorName.trim()
        : "Anonymous";

    const insertResult = await pool.query(
      `INSERT INTO problem_messages (problem_id, author_name, body)
       VALUES ($1, $2, $3)
       RETURNING id, author_name, body, created_at`,
      [problemResult.rows[0].id, name, body.trim()]
    );

    res.status(201).json({ message: insertResult.rows[0] });
  } catch {
    res.status(500).json({ error: "Failed to post message." });
  }
});

app.post("/problems/:id/run", async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);
  const { languageKey, languageId, sourceCode, input } = req.body || {};

  if (!sourceCode || (!languageKey && !languageId)) {
    res.status(400).json({
      error: "languageKey (or languageId) and sourceCode are required.",
    });
    return;
  }

  try {
    const problemResult = await pool.query(
      `SELECT id, time_limit_ms, memory_limit_kb
       FROM problems
       WHERE ${isNumeric ? "id" : "slug"} = $1
       LIMIT 1`,
      [id]
    );

    if (problemResult.rows.length === 0) {
      res.status(404).json({ error: "Problem not found." });
      return;
    }

    const languageResult = await pool.query(
      `SELECT id, key, name, source_ext, compile_command, run_command,
              default_time_limit_ms, default_memory_limit_kb
       FROM languages
       WHERE ${languageKey ? "key" : "id"} = $1 AND enabled = TRUE`,
      [languageKey || languageId]
    );

    if (languageResult.rows.length === 0) {
      res.status(404).json({ error: "Language not found." });
      return;
    }

    const runResult = await runCode({
      language: languageResult.rows[0],
      problem: problemResult.rows[0],
      sourceCode,
      input: typeof input === "string" ? input : "",
    });

    res.json(runResult);
  } catch {
    res.status(500).json({ error: "Failed to run code." });
  }
});

app.post("/submissions", async (req, res) => {
  const { problemId, languageKey, languageId, sourceCode } = req.body || {};

  if (!problemId || !sourceCode || (!languageKey && !languageId)) {
    res.status(400).json({
      error: "problemId, languageKey (or languageId), and sourceCode are required.",
    });
    return;
  }

  const codeLength = sourceCode.length;

  const client = await pool.connect();
  try {
    const problemResult = await client.query(
      `SELECT id,
              time_limit_ms,
              memory_limit_kb,
              judge_type,
              checker_language_key,
              checker_source
       FROM problems
       WHERE id = $1`,
      [problemId]
    );

    if (problemResult.rows.length === 0) {
      res.status(404).json({ error: "Problem not found." });
      return;
    }

    const problem = problemResult.rows[0];

    const languageResult = await client.query(
      `SELECT id, key, name, source_ext, compile_command, run_command,
              default_time_limit_ms, default_memory_limit_kb
       FROM languages
       WHERE ${languageKey ? "key" : "id"} = $1 AND enabled = TRUE`,
      [languageKey || languageId]
    );

    if (languageResult.rows.length === 0) {
      res.status(404).json({ error: "Language not found." });
      return;
    }

    let checker = null;
    if (problem.judge_type === "custom") {
      if (!problem.checker_language_key || !problem.checker_source) {
        res.status(500).json({ error: "Checker is not configured." });
        return;
      }

      const checkerLanguageResult = await client.query(
        `SELECT id, key, name, source_ext, compile_command, run_command,
                default_time_limit_ms, default_memory_limit_kb
         FROM languages
         WHERE key = $1 AND enabled = TRUE`,
        [problem.checker_language_key]
      );

      if (checkerLanguageResult.rows.length === 0) {
        res.status(500).json({ error: "Checker language not found." });
        return;
      }

      checker = {
        language: checkerLanguageResult.rows[0],
        sourceCode: problem.checker_source,
      };
    }

    const testcasesResult = await client.query(
      `SELECT id, name, input, expected_output
       FROM testcases
       WHERE problem_id = $1
       ORDER BY sort_order, id`,
      [problemId]
    );

    const submissionResult = await client.query(
      `INSERT INTO submissions (problem_id, language_id, source_code, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [problemId, languageResult.rows[0].id, sourceCode, "Judging"]
    );

    const submissionId = submissionResult.rows[0].id;

    const judgeResult = await judgeSubmission({
      language: languageResult.rows[0],
      problem,
      testcases: testcasesResult.rows,
      sourceCode,
      checker,
    });

    await client.query("BEGIN");

    for (const result of judgeResult.results) {
      await client.query(
        `INSERT INTO submission_results
          (submission_id, testcase_id, status, exec_time_ms, memory_kb, output, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          submissionId,
          result.testcaseId,
          result.status,
          result.execTimeMs,
          result.memoryKb,
          result.output,
          result.error,
        ]
      );
    }

    await client.query(
      `UPDATE submissions
       SET status = $1,
           verdict = $1,
           exec_time_ms = $2,
           memory_kb = $3,
           compiler_output = $4,
           judged_at = NOW()
       WHERE id = $5`,
      [
        judgeResult.verdict,
        judgeResult.maxTimeMs,
        judgeResult.maxMemoryKb,
        judgeResult.compileOutput,
        submissionId,
      ]
    );

    await client.query("COMMIT");

    res.json({
      submissionId,
      verdict: judgeResult.verdict,
      compilerOutput: judgeResult.compileOutput,
      codeLength,
      results: judgeResult.results.map((result) => ({
        testcaseId: result.testcaseId,
        name: result.name,
        status: result.status,
        execTimeMs: result.execTimeMs,
        memoryKb: result.memoryKb,
        output: result.output,
        error: result.error,
      })),
    });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to judge submission." });
  } finally {
    client.release();
  }
});

app.get("/submissions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const submissionResult = await pool.query(
      `SELECT id, problem_id, language_id, status, verdict, exec_time_ms,
              compiler_output, created_at, judged_at
       FROM submissions
       WHERE id = $1`,
      [id]
    );

    if (submissionResult.rows.length === 0) {
      res.status(404).json({ error: "Submission not found." });
      return;
    }

    const results = await pool.query(
      `SELECT testcase_id, status, exec_time_ms, output, error
       FROM submission_results
       WHERE submission_id = $1
       ORDER BY id`,
      [id]
    );

    res.json({
      submission: submissionResult.rows[0],
      results: results.rows,
    });
  } catch {
    res.status(500).json({ error: "Failed to load submission." });
  }
});

app.listen(PORT, () => {
  console.log(`OJ API listening on :${PORT}`);
});
