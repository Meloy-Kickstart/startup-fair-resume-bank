import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import archiver from 'archiver';
import { pool, init, getToken, rotateToken, tokenFromEnv, logEvent, randomToken } from './db.js';
import * as V from './views.js';
import { MAIN_LINKS, ALL_LINKS, LOOKING_FOR, gradTerms, MAX_RESUME_MB } from './config.js';
import { toCSV, clean, cleanUrl, isEmail, pick, fileSlug } from './util.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PROD = process.env.NODE_ENV === 'production';
const baseUrl = (req) =>
  (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'none'",
  });
  next();
});
app.use(express.static('public', { maxAge: PROD ? '1h' : 0 }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));
app.get('/healthz', async (req, res) => {
  await pool.query('select 1');
  res.send('ok');
});

/* ---------------- tiny rate limit (whole fair shares one campus IP, so keep it loose) ---------------- */
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const rec = hits.get(key) || { n: 0, t: now };
    if (now - rec.t > windowMs) Object.assign(rec, { n: 0, t: now });
    rec.n++;
    hits.set(key, rec);
    if (rec.n > max) return res.status(429).send(V.message('Slow down', 'Too many tries. Wait a minute and try again.'));
    next();
  };
}
setInterval(() => {
  const cut = Date.now() - 15 * 60_000;
  for (const [k, v] of hits) if (v.t < cut) hits.delete(k);
}, 5 * 60_000).unref();

/* ---------------- student side ---------------- */

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RESUME_MB * 1024 * 1024, files: 1, fields: 30 } });

app.get('/', (req, res) => res.send(V.studentForm()));

app.post('/submit', rateLimit(400, 10 * 60_000), (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `Your PDF is larger than ${MAX_RESUME_MB} MB. Export a smaller PDF and try again.` : 'The upload failed. Try again.';
      return res.status(400).send(V.studentForm({ values: req.body || {}, error: msg }));
    }
    next();
  });
}, async (req, res) => {
  const b = req.body || {};
  const v = {
    first_name: clean(b.first_name, 60),
    last_name: clean(b.last_name, 60),
    email: clean(b.email, 120).toLowerCase(),
    major: clean(b.major, 80),
    grad_term: gradTerms().includes(b.grad_term) ? b.grad_term : '',
    degree: clean(b.degree, 30),
    looking_for: pick(b.looking_for, LOOKING_FOR),
    linkedin: cleanUrl(b.linkedin),
    phone: clean(b.phone, 30),
    share_consent: true, // the form states that companies see every submission
    meloy_optin: b.meloy_optin === 'yes',
  };
  const formValues = { ...v, linkedin: clean(b.linkedin, 200) };
  const fail = (error) => res.status(400).send(V.studentForm({ values: formValues, error }));

  if (!v.first_name || !v.last_name) return fail('Enter your first and last name.');
  if (!isEmail(v.email)) return fail('Enter a valid email address.');
  if (!v.major) return fail('Enter your major.');
  if (!v.grad_term) return fail('Select your graduation term.');

  const file = req.file;
  const hasFile = file && file.size > 0;
  if (hasFile && file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') return fail('Your resume must be a PDF file.');

  const existing = (await pool.query('select id, ref from students where lower(email) = $1', [v.email])).rows[0];
  if (!existing && !hasFile) return fail('Attach your resume as a PDF.');

  let student;
  const fields = [v.first_name, v.last_name, v.email, v.phone || null, v.major, v.degree || null, v.grad_term, v.looking_for, v.linkedin || null, v.share_consent, v.meloy_optin];
  if (existing) {
    const params = [...fields, existing.id];
    let sql = `update students set first_name=$1, last_name=$2, email=$3, phone=$4, major=$5, degree=$6, grad_term=$7,
      looking_for=$8, linkedin=$9, share_consent=$10, meloy_optin = meloy_optin or $11, submissions = submissions + 1, updated_at = now()`;
    if (hasFile) {
      params.push(file.buffer, clean(file.originalname, 120) || 'resume.pdf', file.size);
      sql += `, resume=$13, resume_name=$14, resume_size=$15`;
    }
    sql += ' where id=$12 returning id, ref, first_name';
    student = (await pool.query(sql, params)).rows[0];
  } else {
    student = (
      await pool.query(
        `insert into students (first_name, last_name, email, phone, major, degree, grad_term, looking_for, linkedin, share_consent, meloy_optin, ref, resume, resume_name, resume_size)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         on conflict (lower(email)) do nothing returning id, ref, first_name`,
        [...fields, randomToken(12), file.buffer, clean(file.originalname, 120) || 'resume.pdf', file.size],
      )
    ).rows[0];
    if (!student) return fail('This email was just used. Submit again to update that check-in.');
  }
  await logEvent(existing ? 'student_update' : 'student_checkin', { studentId: student.id });
  res.redirect(303, `/thanks/${encodeURIComponent(student.ref)}${existing ? '?updated=1' : ''}`);
});

app.get('/thanks/:ref', async (req, res) => {
  const student = (await pool.query('select id, ref, first_name from students where ref = $1', [req.params.ref])).rows[0];
  if (!student) return res.redirect('/');
  res.send(V.thanks({ student, updated: req.query.updated === '1' }));
});

const LINK_BY_KEY = Object.fromEntries([...MAIN_LINKS, ALL_LINKS].map((l) => [l.key, l]));
app.get('/go/:key', async (req, res) => {
  const link = LINK_BY_KEY[req.params.key];
  if (!link) return res.redirect('/');
  let studentId = null;
  if (typeof req.query.s === 'string') {
    studentId = (await pool.query('select id from students where ref = $1', [req.query.s])).rows[0]?.id ?? null;
  }
  await logEvent('link_click', { studentId, detail: link.key });
  res.redirect(302, link.url);
});

/* ---------------- company registration (link sent by email before the fair) ---------------- */

app.get('/register', (req, res) => res.send(V.register()));

app.post('/register', rateLimit(60, 10 * 60_000), async (req, res) => {
  const b = req.body || {};
  const extraCount = Math.min(Math.max(Number(b.extra_count) || 0, 0), V.MAX_REPS - 1);
  const extras = Array.from({ length: extraCount }, (_, i) => ({
    name: clean(b[`extra_name_${i + 1}`], 80),
    email: clean(b[`extra_email_${i + 1}`], 120).toLowerCase(),
  }));
  const v = {
    company: clean(b.company, 100),
    contact_name: clean(b.contact_name, 80),
    contact_email: clean(b.contact_email, 120).toLowerCase(),
    roles: clean(b.roles, 200),
    dietary: clean(b.dietary, 300),
  };
  const fail = (error) => res.status(400).send(V.register({ values: { ...v, extra_count: extraCount, extras }, error }));
  if (!v.company) return fail('Enter your company name.');
  if (!v.contact_name) return fail('Enter your name.');
  if (!isEmail(v.contact_email)) return fail('Enter a valid email.');
  for (const [i, p] of extras.entries()) {
    if (!p.name) return fail(`Enter the name of person ${i + 2}.`);
    if (!isEmail(p.email)) return fail(`Enter a valid email for person ${i + 2}.`);
  }
  // the person who fills in the form is person 1
  const reps = [{ name: v.contact_name, email: v.contact_email }, ...extras];
  if (!v.dietary) return fail('Tell us about dietary restrictions. Write “None” if there are none.');

  const { rows } = await pool.query(
    `insert into registrations (company, contact_name, contact_email, reps, roles, dietary)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (lower(contact_email)) do update set company=excluded.company, contact_name=excluded.contact_name,
       reps=excluded.reps, roles=excluded.roles, dietary=excluded.dietary, updated_at=now()
     returning (xmax <> 0) as updated`,
    [v.company, v.contact_name, v.contact_email, JSON.stringify(reps), v.roles || null, v.dietary],
  );
  res.redirect(303, `/registered?c=${encodeURIComponent(v.company)}${rows[0].updated ? '&updated=1' : ''}`);
});

app.get('/registered', (req, res) =>
  res.send(V.registered({ company: clean(req.query.c, 100) || 'friend', updated: req.query.updated === '1' })));

/* ---------------- company side ---------------- */

const safeEq = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const gate = (name) => async (req, res, next) => {
  if (!safeEq(req.params.token, await getToken(name))) return res.status(404).send(V.message('Page not found', 'Check the link and try again.', 'Not found'));
  next();
};

// The company link is the only lock: anyone with it sees every student.
app.get('/c/:token', gate('company'), async (req, res) => {
  const total = (await pool.query('select count(*)::int n from students where share_consent')).rows[0].n;
  res.set('Cache-Control', 'no-store').send(V.bank({ token: req.params.token, total }));
});

const PUBLIC_COLS = `id, first_name, last_name, email, phone, major, degree, grad_term, looking_for, linkedin, created_at, updated_at, resume_size`;
const TERM_ORDER = `split_part(grad_term, ' ', 2)::int * 10 + case split_part(grad_term, ' ', 1) when 'Spring' then 1 when 'Summer' then 2 else 3 end`;

/** One filter for the list, the CSV and the ZIP, so a download always matches what is on screen. */
function studentQuery(q, cols = PUBLIC_COLS) {
  const where = ['share_consent'];
  const params = [];
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replace('?', `$${params.length}`));
  };
  const text = clean(q.q, 100);
  if (text) add(`(first_name || ' ' || last_name || ' ' || email || ' ' || major) ilike ?`, `%${text.replace(/[\\%_]/g, '\\$&')}%`);
  if (clean(q.major, 80)) add('major = ?', clean(q.major, 80));
  if (/^\d{4}$/.test(q.year || '')) add(`grad_term like ?`, `% ${q.year}`);
  if (LOOKING_FOR.includes(q.looking)) add('? = any(looking_for)', q.looking);
  const order = q.sort === 'name' ? 'lower(last_name), lower(first_name)' : q.sort === 'grad' ? `${TERM_ORDER}, lower(last_name)` : 'updated_at desc';
  return { sql: `select ${cols} from students where ${where.join(' and ')} order by ${order}`, params };
}

app.get('/c/:token/api/students', gate('company'), async (req, res) => {
  const { sql, params } = studentQuery(req.query);
  const { rows } = await pool.query(sql, params);
  const facets = (await pool.query(`select array(select distinct major from students where share_consent order by 1) majors,
    array(select distinct split_part(grad_term, ' ', 2) from students where share_consent order by 1) years`)).rows[0];
  res.set('Cache-Control', 'no-store').json({ students: rows, facets });
});

async function sendResume(req, res, { track = false } = {}) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.sendStatus(404);
  const s = (await pool.query('select id, first_name, last_name, major, resume from students where id = $1 and share_consent', [id])).rows[0];
  if (!s) return res.sendStatus(404);
  const download = req.query.dl === '1';
  if (track) await logEvent(download ? 'resume_download' : 'resume_view', { studentId: s.id });
  const name = `${fileSlug(`${s.last_name}_${s.first_name}_Resume`)}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
    'Cache-Control': 'private, no-store',
  });
  res.removeHeader('Content-Security-Policy'); // a strict CSP can stop the browser PDF viewer
  res.removeHeader('Referrer-Policy');
  res.send(s.resume);
}

app.get('/c/:token/resume/:id', gate('company'), (req, res) => sendResume(req, res, { track: true }));

const STUDENT_CSV = [
  ['First name', 'first_name'], ['Last name', 'last_name'], ['Email', 'email'], ['Phone', 'phone'], ['Major', 'major'],
  ['Degree', 'degree'], ['Graduation', 'grad_term'], ['Looking for', (r) => r.looking_for.join('; ')], ['LinkedIn', 'linkedin'],
  ['Checked in', (r) => new Date(r.created_at).toISOString()],
];

const sendCSV = (res, filename, csv) => {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' });
  res.send(`﻿${csv}`);
};

app.get('/c/:token/students.csv', gate('company'), async (req, res) => {
  const { sql, params } = studentQuery(req.query);
  const { rows } = await pool.query(sql, params);
  await logEvent('csv_export', { detail: `${rows.length} students` });
  sendCSV(res, 'startup-fair-students.csv', toCSV(rows, STUDENT_CSV));
});

async function sendZip(res, q, filename) {
  const { sql, params } = studentQuery(q, 'id, first_name, last_name, major');
  const { rows } = await pool.query(sql, params);
  res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' });
  const zip = archiver('zip', { zlib: { level: 1 } });
  zip.on('error', (err) => {
    console.error('zip failed', err);
    res.destroy(err);
  });
  zip.pipe(res);
  const used = new Set();
  // fetch one resume at a time so a big bank does not fill the memory
  for (const r of rows) {
    const pdf = (await pool.query('select resume from students where id = $1', [r.id])).rows[0]?.resume;
    if (!pdf) continue;
    let name = fileSlug(`${r.last_name}_${r.first_name}_${r.major}`);
    for (let i = 2; used.has(name); i++) name = `${fileSlug(`${r.last_name}_${r.first_name}_${r.major}`)}_${i}`;
    used.add(name);
    zip.append(pdf, { name: `${name}.pdf` });
  }
  await zip.finalize();
  return rows.length;
}

app.get('/c/:token/resumes.zip', gate('company'), async (req, res) => {
  const n = await sendZip(res, req.query, 'startup-fair-resumes.zip');
  await logEvent('zip_export', { detail: `${n} resumes` });
});

/* ---------------- staff side ---------------- */

const adminRouter = express.Router({ mergeParams: true });
app.use('/a/:token', gate('admin'), adminRouter);

async function links(req) {
  const base = baseUrl(req);
  return { student: `${base}/`, company: `${base}/c/${await getToken('company')}`, register: `${base}/register` };
}

adminRouter.get('/', async (req, res) => {
  const [stats, students, clicks, registrations] = await Promise.all([
    pool.query(`select (select count(*) from students)::int students, (select count(*) from students where meloy_optin)::int optins,
      (select count(*) from registrations)::int registered, (select coalesce(sum(jsonb_array_length(reps)), 0) from registrations)::int reps,
      (select count(*) from events where kind in ('resume_view','resume_download'))::int views`),
    pool.query(`select s.id, s.first_name, s.last_name, s.email, s.major, s.degree, s.grad_term, s.meloy_optin, s.updated_at,
      (select count(*) from events e where e.student_id = s.id and e.kind in ('resume_view','resume_download'))::int resume_views,
      (select count(*) from events e where e.student_id = s.id and e.kind = 'link_click')::int link_clicks
      from students s order by s.updated_at desc`),
    pool.query(`select detail, count(*)::int n from events where kind = 'link_click' group by detail order by n desc`),
    pool.query('select * from registrations order by updated_at desc'),
  ]);
  const label = (k) => LINK_BY_KEY[k]?.label || k;
  res.set('Cache-Control', 'no-store').send(
    V.admin({
      token: req.params.token,
      links: await links(req),
      stats: stats.rows[0],
      students: students.rows,
      registrations: registrations.rows,
      clicks: clicks.rows.map((c) => ({ label: label(c.detail), n: c.n })),
      companyTokenFromEnv: tokenFromEnv('company'),
    }),
  );
});

adminRouter.get('/qr/:file', async (req, res) => {
  const m = /^(student|company)\.(svg|png)$/.exec(req.params.file);
  if (!m) return res.sendStatus(404);
  const url = (await links(req))[m[1]];
  const opts = { margin: 1, errorCorrectionLevel: 'M', color: { dark: '#500000', light: '#ffffff' } };
  res.set('Cache-Control', 'no-store');
  if (m[2] === 'svg') return res.type('image/svg+xml').send(await QRCode.toString(url, { ...opts, type: 'svg' }));
  res.type('image/png').send(await QRCode.toBuffer(url, { ...opts, width: 1600 }));
});

adminRouter.get('/poster/:which', async (req, res) => {
  const which = req.params.which;
  if (!['student', 'company'].includes(which)) return res.sendStatus(404);
  const url = (await links(req))[which];
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#500000', light: '#ffffff' } });
  res.set('Cache-Control', 'no-store').send(V.poster({ which, url, qrSvg }));
});

adminRouter.post('/rotate-company', async (req, res) => {
  if (!tokenFromEnv('company')) await rotateToken('company');
  res.redirect(303, `/a/${encodeURIComponent(req.params.token)}`);
});

adminRouter.post('/students/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isInteger(id)) await pool.query('delete from students where id = $1', [id]);
  res.redirect(303, `/a/${encodeURIComponent(req.params.token)}`);
});

adminRouter.get('/resume/:id', (req, res) => sendResume(req, res));

const ADMIN_STUDENT_CSV = [
  ...STUDENT_CSV,
  ['Wants Meloy emails', (r) => (r.meloy_optin ? 'Yes' : 'No')],
  ['Resume views', 'resume_views'],
  ['Meloy links clicked', 'links'],
  ['Times submitted', 'submissions'],
  ['Last updated', (r) => new Date(r.updated_at).toISOString()],
];

adminRouter.get('/export/:file', async (req, res) => {
  const f = req.params.file;
  if (f === 'resumes.zip') return sendZip(res, {}, 'startup-fair-resumes-all.zip');
  if (f === 'students.csv' || f === 'leads.csv') {
    const { rows } = await pool.query(`select s.*,
      (select count(*) from events e where e.student_id = s.id and e.kind in ('resume_view','resume_download'))::int resume_views,
      (select string_agg(distinct detail, '; ') from events e where e.student_id = s.id and e.kind = 'link_click') links
      from students s ${f === 'leads.csv' ? 'where meloy_optin' : ''} order by created_at`);
    return sendCSV(res, f === 'leads.csv' ? 'meloy-warm-leads.csv' : 'startup-fair-students-all.csv', toCSV(rows, ADMIN_STUDENT_CSV));
  }
  if (f === 'registrations.csv') {
    const { rows } = await pool.query('select * from registrations order by created_at');
    const cols = [
      ['Company', 'company'], ['Contact', 'contact_name'], ['Email', 'contact_email'],
      ['People coming', (r) => r.reps.length],
      ...Array.from({ length: V.MAX_REPS }, (_, i) => [
        [`Person ${i + 1} name`, (r) => r.reps[i]?.name], [`Person ${i + 1} email`, (r) => r.reps[i]?.email],
      ]).flat(),
      ['Majors wanted', 'roles'], ['Dietary restrictions', 'dietary'],
      ['Registered', (r) => new Date(r.created_at).toISOString()], ['Last updated', (r) => new Date(r.updated_at).toISOString()],
    ];
    return sendCSV(res, 'startup-fair-company-registrations.csv', toCSV(rows, cols));
  }
  if (f === 'activity.csv') {
    const { rows } = await pool.query(`select e.created_at, e.kind, s.first_name || ' ' || s.last_name student, s.email student_email, e.detail
      from events e left join students s on s.id = e.student_id order by e.created_at`);
    return sendCSV(res, 'startup-fair-activity.csv', toCSV(rows, [
      ['Time', (r) => new Date(r.created_at).toISOString()], ['Event', 'kind'], ['Student', 'student'], ['Student email', 'student_email'], ['Detail', 'detail'],
    ]));
  }
  res.sendStatus(404);
});

/* ---------------- errors ---------------- */

app.use((req, res) => res.status(404).send(V.message('Page not found', 'Check the link and try again.', 'Not found')));
app.use((err, req, res, _next) => {
  console.error(err);
  if (res.headersSent) return res.destroy();
  res.status(500).send(V.message('Something went wrong', 'Try again in a moment.', 'Error'));
});

await init();
const server = app.listen(PORT, async () => {
  const base = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
  console.log(`Student page: ${base}/`);
  console.log(`Company page: ${base}/c/${await getToken('company')}`);
  console.log(`Staff page:   ${base}/a/${await getToken('admin')}`);
});

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Set PORT to another number.` : err);
  process.exit(1);
});

const stop = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
