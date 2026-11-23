import pg from 'pg';
import crypto from 'node:crypto';

const url = process.env.DATABASE_URL || 'postgres://localhost:5432/resume_bank';
const local = ['localhost', '127.0.0.1', ''].includes(new URL(url).hostname) || process.env.PGSSL === 'off';

export const pool = new pg.Pool({
  connectionString: url,
  ssl: local ? false : { rejectUnauthorized: false },
  max: 5,
});

const SCHEMA = `
create table if not exists settings (
  key   text primary key,
  value text not null
);

create table if not exists students (
  id            serial primary key,
  ref           text unique not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text,
  major         text not null,
  degree        text,
  grad_term     text not null,
  looking_for   text[] not null default '{}',
  linkedin      text,
  share_consent boolean not null,
  meloy_optin   boolean not null default false,
  submissions   int not null default 1,
  resume        bytea not null,
  resume_name   text not null,
  resume_size   int not null
);
create unique index if not exists students_email_key on students (lower(email));

create table if not exists registrations (
  id            serial primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  company       text not null,
  contact_name  text not null,
  contact_email text not null,
  reps          jsonb not null default '[]',
  roles         text,
  dietary       text
);
create unique index if not exists registrations_email_key on registrations (lower(contact_email));

create table if not exists events (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  kind       text not null,
  student_id int references students(id) on delete cascade,
  detail     text
);
create index if not exists events_kind_idx on events (kind);
`;

export async function init() {
  await pool.query(SCHEMA);
}

export const randomToken = (bytes = 18) => crypto.randomBytes(bytes).toString('base64url');

/** Secret link tokens. An env var wins; otherwise a random token is made once and kept in the DB. */
const cache = {};
export async function getToken(name) {
  const env = process.env[`${name.toUpperCase()}_TOKEN`];
  if (env) return env;
  if (cache[name]) return cache[name];
  const key = `${name}_token`;
  await pool.query(
    'insert into settings (key, value) values ($1, $2) on conflict (key) do nothing',
    [key, randomToken()],
  );
  const { rows } = await pool.query('select value from settings where key = $1', [key]);
  cache[name] = rows[0].value;
  return cache[name];
}

export async function rotateToken(name) {
  const value = randomToken();
  await pool.query(
    'insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value',
    [`${name}_token`, value],
  );
  cache[name] = value;
  return value;
}

export const tokenFromEnv = (name) => Boolean(process.env[`${name.toUpperCase()}_TOKEN`]);

export async function logEvent(kind, { studentId = null, detail = null } = {}) {
  try {
    await pool.query(
      'insert into events (kind, student_id, detail) values ($1, $2, $3)',
      [kind, studentId, detail],
    );
  } catch (err) {
    console.error('event log failed', err.message);
  }
}
