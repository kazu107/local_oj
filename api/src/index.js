import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { judgeSubmission, runCode } from "./judge.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

function slugify(value) {
  if (!value) {
    return "";
  }
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
      `SELECT id, slug, title, difficulty, time_limit_ms, memory_limit_kb, points
       FROM problems
       WHERE is_visible = TRUE
       ORDER BY id`
    );
    res.json({ problems: rows });
  } catch {
    res.status(500).json({ error: "Failed to load problems." });
  }
});

app.post("/preview-judge", async (req, res) => {
  const {
    languageKey,
    sourceCode,
    judgeType,
    checkerLanguageKey,
    checkerSource,
    timeLimitMs,
    memoryLimitKb,
    testcases,
  } = req.body || {};

  if (!languageKey || typeof sourceCode !== "string") {
    res.status(400).json({ error: "languageKey and sourceCode are required." });
    return;
  }

  if (!Array.isArray(testcases) || testcases.length === 0) {
    res.status(400).json({ error: "At least one testcase is required." });
    return;
  }

  const safeJudgeType = judgeType === "custom" ? "custom" : "default";

  const normalizedTestcases = testcases.map((item, index) => ({
    id: index + 1,
    name:
      typeof item?.name === "string" && item.name.trim()
        ? item.name.trim()
        : null,
    input: typeof item?.input === "string" ? item.input : "",
    expected_output:
      typeof item?.expectedOutput === "string" ? item.expectedOutput : "",
  }));

  if (normalizedTestcases.some((item) => !item.input.trim())) {
    res.status(400).json({ error: "Every testcase needs input." });
    return;
  }

  if (
    safeJudgeType === "default" &&
    normalizedTestcases.some((item) => !item.expected_output.trim())
  ) {
    res
      .status(400)
      .json({ error: "Expected output is required for default judging." });
    return;
  }

  if (
    safeJudgeType === "custom" &&
    (!checkerLanguageKey ||
      typeof checkerSource !== "string" ||
      !checkerSource.trim())
  ) {
    res.status(400).json({
      error: "Checker language and script are required for custom judging.",
    });
    return;
  }

  try {
    const languageResult = await pool.query(
      `SELECT id, key, name, source_ext, compile_command, run_command,
              default_time_limit_ms, default_memory_limit_kb
       FROM languages
       WHERE key = $1 AND enabled = TRUE`,
      [languageKey]
    );

    if (languageResult.rows.length === 0) {
      res.status(404).json({ error: "Language not found." });
      return;
    }

    let checker = null;
    if (safeJudgeType === "custom") {
      const checkerLanguageResult = await pool.query(
        `SELECT id, key, name, source_ext, compile_command, run_command,
                default_time_limit_ms, default_memory_limit_kb
         FROM languages
         WHERE key = $1 AND enabled = TRUE`,
        [checkerLanguageKey]
      );

      if (checkerLanguageResult.rows.length === 0) {
        res.status(400).json({ error: "Checker language not found." });
        return;
      }

      checker = {
        language: checkerLanguageResult.rows[0],
        sourceCode: checkerSource.trim(),
      };
    }

    const parsedTimeLimit = Number.parseInt(timeLimitMs, 10);
    const parsedMemoryLimit = Number.parseInt(memoryLimitKb, 10);

    const problem = {
      time_limit_ms: Number.isFinite(parsedTimeLimit) ? parsedTimeLimit : 2000,
      memory_limit_kb: Number.isFinite(parsedMemoryLimit)
        ? parsedMemoryLimit
        : 262144,
      judge_type: safeJudgeType,
    };

    const judgeResult = await judgeSubmission({
      language: languageResult.rows[0],
      problem,
      testcases: normalizedTestcases,
      sourceCode,
      checker,
    });

    res.json({
      verdict: judgeResult.verdict,
      compileOutput: judgeResult.compileOutput,
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
    res.status(500).json({ error: "Failed to run validation." });
  }
});

app.post("/problems", async (req, res) => {
  const {
    title,
    slug,
    statement,
    editorial,
    constraints,
    inputFormat,
    outputFormat,
    points,
    timeLimitMs,
    memoryLimitKb,
    difficulty,
    judgeType,
    checkerLanguageKey,
    checkerSource,
    groups,
    testcases,
  } = req.body || {};

  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const trimmedStatement =
    typeof statement === "string" ? statement.trim() : "";
  const normalizedSlug =
    typeof slug === "string" && slug.trim()
      ? slug.trim()
      : slugify(trimmedTitle);
  const safeJudgeType = judgeType === "custom" ? "custom" : "default";

  if (!trimmedTitle || !trimmedStatement) {
    res.status(400).json({ error: "Title and statement are required." });
    return;
  }

  if (!normalizedSlug) {
    res.status(400).json({ error: "Slug is required." });
    return;
  }

  if (!Array.isArray(testcases) || testcases.length === 0) {
    res.status(400).json({ error: "At least one testcase is required." });
    return;
  }

  const normalizedTestcases = testcases.map((item, index) => {
    const name =
      typeof item?.name === "string" && item.name.trim()
        ? item.name.trim()
        : null;
    const input = typeof item?.input === "string" ? item.input : "";
    const expectedOutput =
      typeof item?.expectedOutput === "string" ? item.expectedOutput : "";
    const parsedGroupId = Number.parseInt(item?.groupId, 10);
    const groupId = Number.isFinite(parsedGroupId) ? parsedGroupId : null;
    const isSample = Boolean(item?.isSample);
    return {
      name,
      input,
      expectedOutput,
      groupId,
      isSample,
      sortOrder: index + 1,
    };
  });

  if (normalizedTestcases.some((item) => !item.input.trim())) {
    res.status(400).json({ error: "Every testcase needs input." });
    return;
  }

  if (
    safeJudgeType === "default" &&
    normalizedTestcases.some((item) => !item.expectedOutput.trim())
  ) {
    res
      .status(400)
      .json({ error: "Expected output is required for default judging." });
    return;
  }

  if (
    safeJudgeType === "custom" &&
    (!checkerLanguageKey ||
      typeof checkerSource !== "string" ||
      !checkerSource.trim())
  ) {
    res.status(400).json({
      error: "Checker language and script are required for custom judging.",
    });
    return;
  }

  const normalizedGroups = Array.isArray(groups)
    ? groups.map((item, index) => {
        const name =
          typeof item?.name === "string" && item.name.trim()
            ? item.name.trim()
            : "";
        const parsedGroupPoints = Number.parseInt(item?.points, 10);
        const groupPoints = Number.isFinite(parsedGroupPoints)
          ? parsedGroupPoints
          : 0;
        const parsedClientId = Number.parseInt(item?.id, 10);
        const clientId = Number.isFinite(parsedClientId)
          ? parsedClientId
          : index + 1;
        return {
          clientId,
          name,
          points: groupPoints,
          sortOrder: index + 1,
        };
      })
    : [];

  if (normalizedGroups.some((group) => !group.name)) {
    res.status(400).json({ error: "Each group needs a name." });
    return;
  }

  const groupNameSet = new Set();
  for (const group of normalizedGroups) {
    const key = group.name.toLowerCase();
    if (groupNameSet.has(key)) {
      res.status(400).json({ error: "Group names must be unique." });
      return;
    }
    groupNameSet.add(key);
  }

  if (normalizedGroups.length > 0) {
    const groupIdSet = new Set(normalizedGroups.map((group) => group.clientId));
    if (
      normalizedTestcases.some(
        (item) => item.groupId == null || !groupIdSet.has(item.groupId)
      )
    ) {
      res.status(400).json({
        error: "Every testcase must belong to a valid group.",
      });
      return;
    }
  }

  const parsedTimeLimit = Number.parseInt(timeLimitMs, 10);
  const parsedMemoryLimit = Number.parseInt(memoryLimitKb, 10);
  const parsedDifficulty = Number.parseInt(difficulty, 10);
  const parsedPoints = Number.parseInt(points, 10);

  const finalTimeLimit = Number.isFinite(parsedTimeLimit)
    ? parsedTimeLimit
    : 2000;
  const finalMemoryLimit = Number.isFinite(parsedMemoryLimit)
    ? parsedMemoryLimit
    : 262144;
  const finalDifficulty = Number.isFinite(parsedDifficulty)
    ? parsedDifficulty
    : null;
  const finalPoints = Number.isFinite(parsedPoints) ? parsedPoints : 100;

  const normalizedConstraints =
    typeof constraints === "string" && constraints.trim()
      ? constraints.trim()
      : null;
  const normalizedEditorial =
    typeof editorial === "string" && editorial.trim()
      ? editorial.trim()
      : null;
  const normalizedInputFormat =
    typeof inputFormat === "string" && inputFormat.trim()
      ? inputFormat.trim()
      : null;
  const normalizedOutputFormat =
    typeof outputFormat === "string" && outputFormat.trim()
      ? outputFormat.trim()
      : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const authorResult = await client.query(
      "SELECT id FROM users WHERE username = 'guest' LIMIT 1"
    );
    const authorId = authorResult.rows[0]?.id ?? null;

    let resolvedCheckerLanguage = null;
    if (safeJudgeType === "custom") {
      const checkerLanguageResult = await client.query(
        `SELECT key
         FROM languages
         WHERE key = $1 AND enabled = TRUE
         LIMIT 1`,
        [checkerLanguageKey]
      );

      if (checkerLanguageResult.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Checker language is invalid." });
        return;
      }

      resolvedCheckerLanguage = checkerLanguageResult.rows[0].key;
    }

    const problemInsert = await client.query(
      `INSERT INTO problems (
         slug,
         title,
         statement,
         editorial,
         constraints,
         input_format,
         output_format,
         points,
         judge_type,
         checker_language_key,
         checker_source,
         time_limit_ms,
         memory_limit_kb,
         difficulty,
         source,
         author_id,
         is_visible,
         published_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, TRUE, NOW())
       RETURNING id, slug`,
      [
        normalizedSlug,
        trimmedTitle,
        trimmedStatement,
        normalizedEditorial,
        normalizedConstraints,
        normalizedInputFormat,
        normalizedOutputFormat,
        finalPoints,
        safeJudgeType,
        resolvedCheckerLanguage,
        safeJudgeType === "custom" ? checkerSource.trim() : null,
        finalTimeLimit,
        finalMemoryLimit,
        finalDifficulty,
        "web",
        authorId,
      ]
    );

    const problemId = problemInsert.rows[0].id;

    const groupIdMap = new Map();
    for (const group of normalizedGroups) {
      const groupInsert = await client.query(
        `INSERT INTO testcase_groups
          (problem_id, name, points, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [problemId, group.name, group.points, group.sortOrder]
      );
      groupIdMap.set(group.clientId, groupInsert.rows[0].id);
    }

    for (const testcase of normalizedTestcases) {
      await client.query(
        `INSERT INTO testcases
          (problem_id, group_id, name, input, expected_output, is_sample, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          problemId,
          testcase.groupId != null ? groupIdMap.get(testcase.groupId) : null,
          testcase.name,
          testcase.input,
          testcase.expectedOutput,
          testcase.isSample,
          testcase.sortOrder,
        ]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ problemId, slug: problemInsert.rows[0].slug });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") {
      res.status(409).json({ error: "Slug is already in use." });
    } else {
      res.status(500).json({ error: "Failed to create problem." });
    }
  } finally {
    client.release();
  }
});

app.get("/problems/:id", async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);

  try {
    const problemResult = await pool.query(
      `SELECT id, slug, title, statement, editorial, constraints, input_format, output_format,
              time_limit_ms, memory_limit_kb, difficulty, points
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
              s.score,
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
  let submissionId = null;
  let problem = null;
  let language = null;
  let testcases = [];
  let checker = null;
  try {
    const problemResult = await client.query(
      `SELECT id,
              time_limit_ms,
              memory_limit_kb,
              points,
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

    problem = problemResult.rows[0];

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

    language = languageResult.rows[0];

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
      `SELECT t.id,
              t.name,
              t.input,
              t.expected_output,
              t.group_id,
              g.points AS group_points
       FROM testcases t
       LEFT JOIN testcase_groups g ON g.id = t.group_id
       WHERE t.problem_id = $1
       ORDER BY t.sort_order, t.id`,
      [problemId]
    );
    testcases = testcasesResult.rows;

    const submissionResult = await client.query(
      `INSERT INTO submissions (problem_id, language_id, source_code, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [problemId, language.id, sourceCode, "Judging"]
    );

    submissionId = submissionResult.rows[0].id;

    res.status(202).json({
      submissionId,
      status: "Judging",
      codeLength,
    });
  } catch {
    res.status(500).json({ error: "Failed to judge submission." });
  } finally {
    client.release();
  }

  if (!submissionId || !problem || !language) {
    return;
  }

  const runJudge = async () => {
    const judgeClient = await pool.connect();
    try {
      const judgeResult = await judgeSubmission({
        language,
        problem,
        testcases,
        sourceCode,
        checker,
        onResult: async (result) => {
          await judgeClient.query(
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
        },
      });

      await judgeClient.query(
        `UPDATE submissions
         SET status = $1,
             verdict = $1,
             exec_time_ms = $2,
             memory_kb = $3,
             compiler_output = $4,
             score = $5,
             judged_at = NOW()
         WHERE id = $6`,
        [
          judgeResult.verdict,
          judgeResult.maxTimeMs,
          judgeResult.maxMemoryKb,
          judgeResult.compileOutput,
          judgeResult.score ?? 0,
          submissionId,
        ]
      );
    } catch (error) {
      await judgeClient.query(
        `UPDATE submissions
         SET status = $1,
             verdict = $1,
             compiler_output = $2,
             score = 0,
             judged_at = NOW()
         WHERE id = $3`,
        [
          "System Error",
          error instanceof Error ? error.message : "Judge failed.",
          submissionId,
        ]
      );
    } finally {
      judgeClient.release();
    }
  };

  setImmediate(() => {
    void runJudge();
  });
});

app.get("/submissions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const submissionResult = await pool.query(
      `SELECT id, problem_id, language_id, status, verdict, exec_time_ms,
              compiler_output, score, created_at, judged_at
       FROM submissions
       WHERE id = $1`,
      [id]
    );

    if (submissionResult.rows.length === 0) {
      res.status(404).json({ error: "Submission not found." });
      return;
    }

    const submission = submissionResult.rows[0];

    const results = await pool.query(
      `SELECT r.testcase_id,
              t.name,
              t.group_id,
              g.name AS group_name,
              g.points AS group_points,
              r.status,
              r.exec_time_ms,
              r.memory_kb,
              r.output,
              r.error
       FROM submission_results r
       JOIN testcases t ON t.id = r.testcase_id
       LEFT JOIN testcase_groups g ON g.id = t.group_id
       WHERE r.submission_id = $1
       ORDER BY r.id`,
      [id]
    );

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM testcases
       WHERE problem_id = $1`,
      [submission.problem_id]
    );

    const groupPointsResult = await pool.query(
      `SELECT SUM(points)::int AS total
       FROM testcase_groups
       WHERE problem_id = $1`,
      [submission.problem_id]
    );

    let totalScore = groupPointsResult.rows[0]?.total ?? null;
    if (totalScore == null) {
      const problemPoints = await pool.query(
        `SELECT points FROM problems WHERE id = $1`,
        [submission.problem_id]
      );
      totalScore = problemPoints.rows[0]?.points ?? null;
    }

    const groupsResult = await pool.query(
      `SELECT id, name, points
       FROM testcase_groups
       WHERE problem_id = $1
       ORDER BY sort_order, id`,
      [submission.problem_id]
    );

    res.json({
      submission,
      results: results.rows,
      totalTestcases: totalResult.rows[0]?.total ?? results.rows.length,
      totalScore,
      groups: groupsResult.rows,
    });
  } catch {
    res.status(500).json({ error: "Failed to load submission." });
  }
});

app.listen(PORT, () => {
  console.log(`OJ API listening on :${PORT}`);
});
