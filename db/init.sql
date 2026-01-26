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

CREATE TABLE testcases (
  id BIGSERIAL PRIMARY KEY,
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
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

COMMIT;
