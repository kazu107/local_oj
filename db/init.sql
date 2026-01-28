BEGIN;

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE languages (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT,
  source_ext TEXT NOT NULL,
  compile_command JSONB,
  run_command JSONB NOT NULL,
  is_interpreted BOOLEAN NOT NULL DEFAULT FALSE,
  default_time_limit_ms INTEGER,
  default_memory_limit_kb INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE problems (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  editorial TEXT,
  constraints TEXT,
  input_format TEXT,
  output_format TEXT,
  points INTEGER NOT NULL DEFAULT 100,
  judge_type TEXT NOT NULL DEFAULT 'default',
  checker_language_key TEXT,
  checker_source TEXT,
  time_limit_ms INTEGER NOT NULL DEFAULT 2000,
  memory_limit_kb INTEGER NOT NULL DEFAULT 262144,
  difficulty INTEGER,
  source TEXT,
  author_id BIGINT REFERENCES users(id),
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE testcase_groups (
  id BIGSERIAL PRIMARY KEY,
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE testcases (
  id BIGSERIAL PRIMARY KEY,
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  group_id BIGINT REFERENCES testcase_groups(id) ON DELETE SET NULL,
  name TEXT,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_sample BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE submissions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language_id BIGINT NOT NULL REFERENCES languages(id),
  source_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  verdict TEXT,
  score INTEGER,
  exec_time_ms INTEGER,
  memory_kb INTEGER,
  compiler_output TEXT,
  runtime_output TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  judged_at TIMESTAMPTZ
);

CREATE TABLE submission_results (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  testcase_id BIGINT NOT NULL REFERENCES testcases(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  exec_time_ms INTEGER,
  memory_kb INTEGER,
  output TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE problem_messages (
  id BIGSERIAL PRIMARY KEY,
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE problem_tags (
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, tag_id)
);

CREATE TABLE contests (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contest_problems (
  contest_id BIGINT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  points INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, problem_id)
);

CREATE TABLE contest_registrations (
  contest_id BIGINT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX idx_testcases_problem_id ON testcases(problem_id);
CREATE INDEX idx_testcases_group_id ON testcases(group_id);
CREATE INDEX idx_testcase_groups_problem_id ON testcase_groups(problem_id);
CREATE INDEX idx_submissions_problem_id ON submissions(problem_id);
CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE INDEX idx_submission_results_submission_id ON submission_results(submission_id);
CREATE INDEX idx_problem_messages_problem_id ON problem_messages(problem_id);

INSERT INTO languages (
  key,
  name,
  version,
  source_ext,
  compile_command,
  run_command,
  is_interpreted,
  default_time_limit_ms,
  default_memory_limit_kb,
  sort_order
) VALUES
  (
    'cpp17',
    'C++17 (g++)',
    'g++',
    'cpp',
    '["g++","-std=c++17","-O2","-pipe","{src}","-o","{exe}"]'::jsonb,
    '["{exe}"]'::jsonb,
    FALSE,
    2000,
    262144,
    1
  ),
  (
    'python3',
    'Python 3',
    'python3',
    'py',
    NULL,
    '["python3","{src}"]'::jsonb,
    TRUE,
    2000,
    262144,
    2
  ),
  (
    'c11',
    'C11 (gcc)',
    'gcc',
    'c',
    '["gcc","-std=c11","-O2","-pipe","{src}","-o","{exe}"]'::jsonb,
    '["{exe}"]'::jsonb,
    FALSE,
    2000,
    262144,
    3
  ),
  (
    'java11',
    'Java 11',
    'openjdk-11',
    'java',
    '["javac","{src}"]'::jsonb,
    '["java","-cp","{workdir}","Main"]'::jsonb,
    FALSE,
    2000,
    262144,
    4
  ),
  (
    'nodejs',
    'JavaScript (Node.js)',
    'node',
    'js',
    NULL,
    '["node","{src}"]'::jsonb,
    TRUE,
    2000,
    262144,
    5
  );

WITH new_user AS (
  INSERT INTO users (username, display_name, role)
  VALUES ('guest', 'Guest', 'system')
  RETURNING id
),
new_problem AS (
  INSERT INTO problems (
    slug,
    title,
  statement,
  editorial,
  constraints,
  input_format,
  output_format,
  points,
    time_limit_ms,
    memory_limit_kb,
    difficulty,
    source,
    author_id,
    is_visible,
    published_at
  )
  SELECT
    'a-plus-b',
    'A + B',
  'Given two integers A and B, output A + B.',
  'Read A and B as 64-bit integers and print their sum.',
  '1 <= A, B <= 10^9',
    'A B',
    'A + B',
    100,
    2000,
    262144,
    100,
    'sample',
    new_user.id,
    TRUE,
    NOW()
  FROM new_user
  RETURNING id
)
INSERT INTO testcases (problem_id, name, input, expected_output, is_sample, sort_order)
SELECT
  new_problem.id,
  data.name,
  data.input,
  data.expected_output,
  data.is_sample,
  data.sort_order
FROM new_problem
CROSS JOIN (
  VALUES
    ('Sample 1', E'1 2\n', E'3\n', TRUE, 1),
    ('Sample 2', E'100 200\n', E'300\n', TRUE, 2),
    ('Hidden 1', E'7 8\n', E'15\n', FALSE, 3)
) AS data(name, input, expected_output, is_sample, sort_order);

INSERT INTO problem_messages (problem_id, author_name, body)
SELECT id, 'Staff', 'Ask questions or share hints here.'
FROM problems
WHERE slug = 'a-plus-b';

WITH custom_problem AS (
  INSERT INTO problems (
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
  SELECT
    'any-permutation',
    'Any Permutation',
    'Given an integer N, output any permutation of the integers from 1 to N.',
    'Any ordering of 1..N is accepted. A simple answer is to print 1 2 3 ... N.',
    '1 <= N <= 100000',
    'N',
    'Any permutation of 1..N (space-separated).',
    100,
    'custom',
    'nodejs',
    $$const fs = require("fs");

const raw = fs.readFileSync(0, "utf8");
let payload = {};
try {
  payload = JSON.parse(raw || "{}");
} catch {
  console.log("Wrong Answer");
  process.exit(0);
}

const input = typeof payload.input === "string" ? payload.input : "";
const output = typeof payload.output === "string" ? payload.output : "";
const tokensIn = input.trim().split(/\s+/);
const n = Number.parseInt(tokensIn[0] || "", 10);

if (!Number.isFinite(n) || n <= 0) {
  console.log("Wrong Answer");
  process.exit(0);
}

const tokensOut = output.trim().split(/\s+/).filter(Boolean);
if (tokensOut.length !== n) {
  console.log("Wrong Answer");
  process.exit(0);
}

const seen = new Set();
for (const token of tokensOut) {
  if (!/^\d+$/.test(token)) {
    console.log("Wrong Answer");
    process.exit(0);
  }
  const value = Number.parseInt(token, 10);
  if (value < 1 || value > n || seen.has(value)) {
    console.log("Wrong Answer");
    process.exit(0);
  }
  seen.add(value);
}

console.log("Accepted");
$$,
    2000,
    262144,
    120,
    'custom',
    (SELECT id FROM users WHERE username = 'guest'),
    TRUE,
    NOW()
  RETURNING id
)
INSERT INTO testcases (problem_id, name, input, expected_output, is_sample, sort_order)
SELECT
  custom_problem.id,
  data.name,
  data.input,
  data.expected_output,
  data.is_sample,
  data.sort_order
FROM custom_problem
CROSS JOIN (
  VALUES
    ('Sample 1', E'3\n', E'1 2 3\n', TRUE, 1),
    ('Sample 2', E'5\n', E'1 2 3 4 5\n', TRUE, 2),
    ('Hidden 1', E'1\n', E'1\n', FALSE, 3)
) AS data(name, input, expected_output, is_sample, sort_order);

INSERT INTO problem_messages (problem_id, author_name, body)
SELECT id, 'Staff', 'This problem uses a custom checker that validates permutations.'
FROM problems
WHERE slug = 'any-permutation';

WITH partial_problem AS (
  INSERT INTO problems (
    slug,
    title,
    statement,
    editorial,
    constraints,
    input_format,
    output_format,
    points,
    time_limit_ms,
    memory_limit_kb,
    difficulty,
    source,
    author_id,
    is_visible,
    published_at
  )
  SELECT
    'array-sum',
    'Array Sum',
    'Given an integer N and N integers, output the sum of the array.',
    'Use 64-bit integers to avoid overflow on large values.',
    '1 <= N <= 10^5, |Ai| <= 10^9',
    'N\\nA1 A2 ... AN',
    'Sum of the array as a 64-bit integer.',
    100,
    2000,
    262144,
    120,
    'sample',
    (SELECT id FROM users WHERE username = 'guest'),
    TRUE,
    NOW()
  RETURNING id
),
group_data AS (
  INSERT INTO testcase_groups (problem_id, name, points, sort_order)
  SELECT partial_problem.id, data.name, data.points, data.sort_order
  FROM partial_problem
  CROSS JOIN (
    VALUES
      ('Small', 25, 1),
      ('Medium', 35, 2),
      ('Large', 40, 3)
  ) AS data(name, points, sort_order)
  RETURNING id, name
),
test_data AS (
  SELECT * FROM (
    VALUES
      ('Small', 'Sample 1', E'3\\n1 2 3\\n', E'6\\n', TRUE, 1),
      ('Small', 'Sample 2', E'5\\n10 20 30 40 50\\n', E'150\\n', TRUE, 2),
      ('Small', 'Small 1', E'4\\n7 8 9 10\\n', E'34\\n', FALSE, 3),
      ('Medium', 'Medium 1', E'6\\n100 200 300 400 500 600\\n', E'2100\\n', FALSE, 4),
      ('Large', 'Large 1', E'3\\n1000000000 1000000000 1000000000\\n', E'3000000000\\n', FALSE, 5)
  ) AS data(group_name, name, input, expected_output, is_sample, sort_order)
)
INSERT INTO testcases (problem_id, group_id, name, input, expected_output, is_sample, sort_order)
SELECT
  partial_problem.id,
  group_data.id,
  test_data.name,
  test_data.input,
  test_data.expected_output,
  test_data.is_sample,
  test_data.sort_order
FROM partial_problem
JOIN test_data ON TRUE
JOIN group_data ON group_data.name = test_data.group_name;

WITH array_problem AS (
  SELECT id FROM problems WHERE slug = 'array-sum' LIMIT 1
),
group_lookup AS (
  SELECT id, name
  FROM testcase_groups
  WHERE problem_id = (SELECT id FROM array_problem)
),
generated_cases AS (
  SELECT
    gs AS idx,
    CASE
      WHEN gs <= 30 THEN 'Small'
      WHEN gs <= 70 THEN 'Medium'
      ELSE 'Large'
    END AS group_name,
    CASE
      WHEN gs <= 30 THEN 5
      WHEN gs <= 70 THEN 40
      ELSE 100
    END AS n_value
  FROM generate_series(1, 95) AS gs
),
numbers AS (
  SELECT
    generated_cases.idx,
    generated_cases.group_name,
    generated_cases.n_value,
    series AS position,
    ((generated_cases.idx * 137 + series * 97) % 2001) - 1000 AS value
  FROM generated_cases
  JOIN LATERAL generate_series(1, generated_cases.n_value) AS series ON TRUE
),
assembled AS (
  SELECT
    idx,
    group_name,
    n_value,
    string_agg(value::text, ' ' ORDER BY position) AS values_text,
    SUM(value)::bigint AS sum_value
  FROM numbers
  GROUP BY idx, group_name, n_value
)
INSERT INTO testcases (problem_id, group_id, name, input, expected_output, is_sample, sort_order)
SELECT
  (SELECT id FROM array_problem),
  group_lookup.id,
  format('%s %s', group_name, idx),
  format(E'%s\\n%s\\n', assembled.n_value, assembled.values_text),
  format(E'%s\\n', assembled.sum_value),
  FALSE,
  100 + assembled.idx
FROM assembled
JOIN group_lookup ON group_lookup.name = assembled.group_name;

INSERT INTO problem_messages (problem_id, author_name, body)
SELECT id, 'Staff', 'This problem includes partial scoring by testcase groups.'
FROM problems
WHERE slug = 'array-sum';

COMMIT;
