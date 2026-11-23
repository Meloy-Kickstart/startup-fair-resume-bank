// End-to-end tests: start the real server against a test database and use it like a browser.
// Needs Postgres. Local default: postgres://localhost:5432/resume_bank_test (created if missing).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';

const DB = process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/resume_bank_test';
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const COMPANY = 'test-company-token';
const ADMIN = 'test-admin-token';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

let server;

async function ensureDb() {
  const url = new URL(DB);
  const name = url.pathname.slice(1);
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [name]);
  if (!rowCount) await admin.query(`create database "${name}"`);
  await admin.end();
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  await c.query('drop table if exists events, students, registrations, settings cascade');
  await c.end();
}

before(async () => {
  await ensureDb();
  server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT), DATABASE_URL: DB, COMPANY_TOKEN: COMPANY, ADMIN_TOKEN: ADMIN, PUBLIC_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start');
});

after(() => server?.kill());

const get = (path) => fetch(BASE + path, { redirect: 'manual' });
const post = (path, body) => fetch(BASE + path, { method: 'POST', body, redirect: 'manual' });
const form = (obj) => new URLSearchParams(obj);

function student(overrides = {}, file = PDF) {
  const f = new FormData();
  const v = { first_name: 'Reveille', last_name: 'Tenth', email: 'rev@tamu.edu', major: 'Computer Science', grad_term: `Spring ${new Date().getFullYear() + 1}`, ...overrides };
  for (const [k, val] of Object.entries(v)) [].concat(val).forEach((x) => f.append(k, x));
  if (file) f.append('resume', new Blob([file], { type: 'application/pdf' }), 'resume.pdf');
  return f;
}

test('pages load and the index is hidden from search engines', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
  assert.match(await res.text(), /Resume Bank/);
  assert.equal((await get('/register')).status, 200);
  assert.match(await (await get('/robots.txt')).text(), /Disallow: \//);
});

test('a student checks in with a PDF and sees the Meloy links', async () => {
  const res = await post('/submit', student({ looking_for: ['Internship', 'Co-op'], meloy_optin: 'yes', linkedin: 'linkedin.com/in/rev' }));
  assert.equal(res.status, 303);
  const thanks = await (await get(res.headers.get('location'))).text();
  assert.match(thanks, /checked in/i);
  assert.match(thanks, /\/go\/apply\?s=/);
});

test('the same email updates the record and keeps one row', async () => {
  const res = await post('/submit', student({ major: 'Computer Engineering' }, null));
  assert.equal(res.status, 303);
  assert.match(res.headers.get('location'), /updated=1/);
  const data = await (await get(`/c/${COMPANY}/api/students`)).json();
  assert.equal(data.students.length, 1);
  assert.equal(data.students[0].major, 'Computer Engineering');
});

test('bad student input is refused with a clear message', async () => {
  const notPdf = await post('/submit', student({ email: 'x@tamu.edu' }, Buffer.from('hello')));
  assert.equal(notPdf.status, 400);
  assert.match(await notPdf.text(), /must be a PDF/);
  const noFile = await post('/submit', student({ email: 'y@tamu.edu' }, null));
  assert.match(await noFile.text(), /Attach your resume/);
  const badEmail = await post('/submit', student({ email: 'nope' }));
  assert.match(await badEmail.text(), /valid email/);
});

test('names cannot inject HTML or spreadsheet formulas', async () => {
  await post('/submit', student({ email: 'evil@tamu.edu', first_name: '=HYPERLINK("x")', last_name: '<script>alert(1)</script>' }));
  const admin = await (await get(`/a/${ADMIN}`)).text();
  assert.ok(!admin.includes('<script>alert(1)</script>'));
  const csv = await (await get(`/c/${COMPANY}/students.csv`)).text();
  assert.match(csv, /"'=HYPERLINK/);
});

test('the company bank is open with the right link and closed with a wrong one', async () => {
  assert.equal((await get('/c/wrong-token')).status, 404);
  assert.equal((await get(`/c/wrong-token/api/students`)).status, 404);
  const page = await get(`/c/${COMPANY}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Find students/);

  const { students } = await (await get(`/c/${COMPANY}/api/students?q=reveille`)).json();
  assert.equal(students.length, 1);
  assert.equal(students[0].email, 'rev@tamu.edu');
  assert.ok(!('resume' in students[0]), 'the list must not carry PDF bytes');

  const pdf = await get(`/c/${COMPANY}/resume/${students[0].id}`);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await pdf.arrayBuffer()), PDF);

  const zip = await get(`/c/${COMPANY}/resumes.zip`);
  assert.equal(zip.headers.get('content-type'), 'application/zip');
  assert.equal(Buffer.from(await zip.arrayBuffer()).subarray(0, 2).toString(), 'PK');
});

test('filters narrow the list', async () => {
  const year = new Date().getFullYear() + 1;
  const co = await (await get(`/c/${COMPANY}/api/students?looking=Co-op`)).json();
  assert.equal(co.students.length, 0, 'update without looking_for cleared it');
  const y = await (await get(`/c/${COMPANY}/api/students?year=${year}`)).json();
  assert.equal(y.students.length, 2);
  const none = await (await get(`/c/${COMPANY}/api/students?year=1999`)).json();
  assert.equal(none.students.length, 0);
});

test('Meloy link clicks redirect and are counted', async () => {
  const res = await get('/go/apply');
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /qualtrics/);
  assert.equal((await get('/go/unknown')).headers.get('location'), '/');
});

test('company registration: person 1 is the contact, extra people need name and email', async () => {
  const base = { company: 'Aggie Drones', contact_name: 'Lee Wu', contact_email: 'lee@drones.io', dietary: 'None' };
  const missing = await post('/register', form({ ...base, extra_count: '1', extra_name_1: 'Kim Park' }));
  assert.match(await missing.text(), /valid email for person 2/);
  const noDiet = await post('/register', form({ ...base, dietary: '' }));
  assert.match(await noDiet.text(), /dietary/i);
  const ok = await post('/register', form({ ...base, extra_count: '9', extra_name_1: 'Kim', extra_email_1: 'kim@drones.io', extra_name_2: 'Ray', extra_email_2: 'ray@drones.io', extra_name_3: 'Ana', extra_email_3: 'ana@drones.io', extra_name_4: 'Too', extra_email_4: 'many@drones.io' }));
  assert.equal(ok.status, 303);
  const csv = await (await get(`/a/${ADMIN}/export/registrations.csv`)).text();
  assert.match(csv, /Aggie Drones,Lee Wu,lee@drones.io,4,Lee Wu,lee@drones.io,Kim,kim@drones.io,Ray/);
  assert.ok(!csv.includes('many@drones.io'), 'at most 4 people');
});

test('staff page and every export work only with the staff link', async () => {
  assert.equal((await get('/a/wrong')).status, 404);
  const page = await (await get(`/a/${ADMIN}`)).text();
  assert.match(page, /Stats/);
  for (const f of ['leads.csv', 'students.csv', 'registrations.csv', 'activity.csv', 'resumes.zip']) {
    assert.equal((await get(`/a/${ADMIN}/export/${f}`)).status, 200, f);
  }
  for (const f of ['qr/student.svg', 'qr/company.png', 'poster/student', 'poster/company']) {
    assert.equal((await get(`/a/${ADMIN}/${f}`)).status, 200, f);
  }
  const leads = await (await get(`/a/${ADMIN}/export/leads.csv`)).text();
  assert.match(leads, /rev@tamu.edu/);
  assert.ok(!leads.includes('evil@tamu.edu'), 'leads list has only students who opted in');
});

test('staff can delete a student', async () => {
  const { students } = await (await get(`/c/${COMPANY}/api/students?q=evil`)).json();
  const res = await post(`/a/${ADMIN}/students/${students[0].id}/delete`, form({}));
  assert.equal(res.status, 303);
  const after = await (await get(`/c/${COMPANY}/api/students?q=evil`)).json();
  assert.equal(after.students.length, 0);
});

test('staff can delete a company registration', async () => {
  const before = await (await get(`/a/${ADMIN}/export/registrations.csv`)).text();
  assert.match(before, /Aggie Drones/);
  const page = await (await get(`/a/${ADMIN}`)).text();
  const id = page.match(/\/registrations\/(\d+)\/delete/)[1];
  assert.equal((await post(`/a/${ADMIN}/registrations/${id}/delete`, form({}))).status, 303);
  const after = await (await get(`/a/${ADMIN}/export/registrations.csv`)).text();
  assert.ok(!after.includes('Aggie Drones'));
});
