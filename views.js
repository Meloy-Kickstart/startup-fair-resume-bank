import { FAIR_PROVIDES, FAIR_BRING, EVENT, MAIN_LINKS, ALL_LINKS, MAJORS, DEGREES, LOOKING_FOR, gradTerms, MAX_RESUME_MB } from './config.js';

export const h = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

const fmtDate = (d) =>
  new Date(d).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function layout({ title, body, wide = false, scripts = [], variant = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#500000">
<title>${h(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
</head>
<body class="${variant}">
<header class="topbar">
  <div class="topbar-inner ${wide ? 'wide' : ''}">
    <a class="brand" href="/">${h(EVENT.title)}</a>
  </div>
</header>
<main class="${wide ? 'wide' : ''}">
${body}
</main>
<footer class="footer">
  <div class="${wide ? 'wide' : ''}">${h(EVENT.orgLong)} &middot; Texas A&amp;M University</div>
</footer>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

function hero(_kicker, title, sub) {
  return `<section class="hero">
  <h1>${h(title)}</h1>
  ${sub ? `<p class="hero-sub">${h(sub)}</p>` : ''}
</section>`;
}

const options = (list, selected) =>
  list.map((o) => `<option value="${h(o)}"${o === selected ? ' selected' : ''}>${h(o)}</option>`).join('');

const checks = (name, list, selected = []) =>
  list
    .map(
      (o) => `<label class="chip-check"><input type="checkbox" name="${name}" value="${h(o)}"${selected.includes(o) ? ' checked' : ''}><span>${h(o)}</span></label>`,
    )
    .join('');

/* ---------------- student pages ---------------- */

export function studentForm({ values = {}, error = '' } = {}) {
  const v = values;
  const body = `
${hero(EVENT.name, 'Resume Bank', 'Check in and share your resume with every startup at the fair')}
<form class="card form" method="post" action="/submit" enctype="multipart/form-data" novalidate data-maxmb="${MAX_RESUME_MB}">
  ${error ? `<div class="alert" role="alert">${h(error)}</div>` : ''}
  <div class="grid2">
    <label class="field"><span>First name</span><input name="first_name" required maxlength="60" autocomplete="given-name" value="${h(v.first_name)}"></label>
    <label class="field"><span>Last name</span><input name="last_name" required maxlength="60" autocomplete="family-name" value="${h(v.last_name)}"></label>
  </div>
  <label class="field"><span>Email</span><input name="email" type="email" required maxlength="120" autocomplete="email" inputmode="email" placeholder="netid@tamu.edu" value="${h(v.email)}"></label>
  <div class="field combo" data-options="${h(JSON.stringify(MAJORS))}">
    <label for="major"><span>Major</span></label>
    <input id="major" name="major" required maxlength="80" autocomplete="off" placeholder="Type to search, e.g. mech" value="${h(v.major)}"
      role="combobox" aria-expanded="false" aria-controls="major-list" aria-autocomplete="list">
    <ul id="major-list" class="combo-list" role="listbox" hidden></ul>
  </div>
  <div class="grid2">
    <label class="field"><span>Graduation</span><select name="grad_term" required><option value="">Select</option>${options(gradTerms(), v.grad_term)}</select></label>
    <label class="field"><span>Degree <em>optional</em></span><select name="degree"><option value="">Select</option>${options(DEGREES, v.degree)}</select></label>
  </div>
  <fieldset class="field">
    <legend>I am looking for <em>optional</em></legend>
    <div class="chips">${checks('looking_for', LOOKING_FOR, [].concat(v.looking_for || []))}</div>
  </fieldset>
  <div class="grid2">
    <label class="field"><span>LinkedIn <em>optional</em></span><input name="linkedin" maxlength="200" inputmode="url" placeholder="linkedin.com/in/you" value="${h(v.linkedin)}"></label>
    <label class="field"><span>Phone <em>optional</em></span><input name="phone" type="tel" maxlength="30" autocomplete="tel" value="${h(v.phone)}"></label>
  </div>
  <label class="field file">
    <span>Resume (PDF, up to ${MAX_RESUME_MB} MB)</span>
    <input name="resume" type="file" accept="application/pdf,.pdf" required>
    <span class="file-box"><strong class="file-name">Choose a PDF</strong><small>Tap to upload from your phone or Drive</small></span>
  </label>
  <div class="consents">
    <label class="consent"><input type="checkbox" name="meloy_optin" value="yes"${v.meloy_optin ? ' checked' : ''}><span>Yes, send me Meloy emails and keep me in the loop about events, grants and startup jobs.</span></label>
  </div>
  <p class="fine notice">When you submit, companies at the fair can see your resume and contact information.</p>
  <button class="btn btn-primary btn-block" type="submit">Check in and upload</button>
</form>`;
  return layout({ title: `${EVENT.name} Resume Bank`, body, scripts: ['/student.js'] });
}

export function thanks({ student, updated }) {
  const ref = encodeURIComponent(student.ref);
  const linkBtn = (l) =>
    `<a class="link-btn" href="/go/${h(l.key)}?s=${ref}" target="_blank" rel="noopener"><span class="link-label">${h(l.label)}</span>${l.note ? `<span class="link-note">${h(l.note)}</span>` : ''}<span class="arrow" aria-hidden="true">&rarr;</span></a>`;
  const body = `
${hero(EVENT.name, updated ? 'Resume updated' : 'You’re checked in', `Thanks, ${student.first_name}. Startups at the fair can now see your resume.`)}
<section class="card">
  <h2 class="section-title">Get involved with Meloy</h2>
  <p class="muted">Meloy helps Aggies build startups, find startup jobs and get funding. Start here:</p>
  <div class="links">${MAIN_LINKS.map(linkBtn).join('')}</div>
  <a class="btn btn-outline btn-block" href="/go/${h(ALL_LINKS.key)}?s=${ref}" target="_blank" rel="noopener">${h(ALL_LINKS.label)}</a>
</section>
<p class="fine center"><a href="/">Check in another student</a></p>`;
  return layout({ title: 'You’re checked in', body });
}

/* ---------------- company pages ---------------- */

export function bank({ token, total }) {
  const t = h(token);
  const body = `
<section class="bank-head">
  <div>
    <h1 class="bank-title">Find students</h1>
    <p class="muted"><span id="count">${total}</span> students</p>
  </div>
  <div class="bank-actions">
    <a class="btn btn-outline" id="csv" href="/c/${t}/students.csv">Download CSV</a>
    <a class="btn btn-primary" id="zip" href="/c/${t}/resumes.zip">Download resumes (ZIP)</a>
  </div>
</section>
<form class="filters card" id="filters" data-token="${t}">
  <label class="field grow"><span>Search</span><input name="q" type="search" placeholder="Name, major, email" autocomplete="off"></label>
  <label class="field"><span>Major</span><select name="major"><option value="">All majors</option></select></label>
  <label class="field"><span>Graduation year</span><select name="year"><option value="">Any year</option></select></label>
  <label class="field"><span>Looking for</span><select name="looking"><option value="">Anything</option>${options(LOOKING_FOR)}</select></label>
  <label class="field"><span>Sort</span><select name="sort"><option value="new">Newest first</option><option value="name">Last name A–Z</option><option value="grad">Graduation date</option></select></label>
</form>
<div id="results" class="results" aria-live="polite"><p class="muted center">Loading students…</p></div>`;
  return layout({ title: 'Resume Bank', body, wide: true, scripts: ['/bank.js'] });
}

/* ---------------- admin page ---------------- */

const stat = (n, label) => `<dt>${h(label)}</dt><dd>${h(n)}</dd>`;

export function admin({ token, links, stats, students, registrations, clicks, companyTokenFromEnv }) {
  const t = h(token);
  const registrationRows = registrations
    .map(
      (r) => `<tr>
  <td><strong>${h(r.company)}</strong></td>
  <td>${h(r.contact_name)}<br><a href="mailto:${h(r.contact_email)}">${h(r.contact_email)}</a></td>
  <td><strong>${r.reps.length}</strong>${r.reps.map((p) => `<br><small>${h(p.name)}${p.email ? ` &middot; <a href="mailto:${h(p.email)}">${h(p.email)}</a>` : ''}</small>`).join('')}</td>
  <td><small>${h(r.roles || '')}</small></td>
  <td><small>${h(r.dietary || '')}</small></td>
  <td><small>${h(fmtDate(r.updated_at))}</small></td>
</tr>`,
    )
    .join('');
  const studentRows = students
    .map(
      (s) => `<tr>
  <td><strong>${h(s.first_name)} ${h(s.last_name)}</strong><br><a href="mailto:${h(s.email)}">${h(s.email)}</a></td>
  <td>${h(s.major)}<br><small>${h(s.degree || '')} ${h(s.grad_term)}</small></td>
  <td>${s.meloy_optin ? '<span class="tag yes">Yes</span>' : '<span class="tag">No</span>'}</td>
  <td>${h(s.resume_views)}</td>
  <td>${h(s.link_clicks)}</td>
  <td><small>${h(fmtDate(s.updated_at))}</small></td>
  <td class="row-actions"><a href="/a/${t}/resume/${s.id}" target="_blank" rel="noopener">Resume</a>
    <form method="post" action="/a/${t}/students/${s.id}/delete" class="confirm" data-confirm="Delete ${h(s.first_name)} ${h(s.last_name)} and their resume? This cannot be undone."><button class="link danger" type="submit">Delete</button></form></td>
</tr>`,
    )
    .join('');

  const linkCard = (which, title, url, note) => `
<div class="card qr-card">
  <h3>${h(title)}</h3>
  <img class="qr" src="/a/${t}/qr/${which}.svg" alt="QR code for the ${h(title.toLowerCase())}" width="180" height="180">
  <div class="copy-row"><input readonly value="${h(url)}" aria-label="${h(title)} link"><button class="btn btn-small" type="button" data-copy="${h(url)}">Copy</button></div>
  <div class="fine">${note}</div>
  <div class="btn-row">
    <a class="btn btn-small btn-outline" href="/a/${t}/poster/${which}" target="_blank" rel="noopener">Print poster</a>
    <a class="btn btn-small btn-outline" href="/a/${t}/qr/${which}.png" download="${which}-qr.png">QR PNG</a>
  </div>
</div>`;

  const body = `
<h2 class="section-title page-top">Links and QR codes</h2>
<div class="qr-grid">
  ${linkCard('student', 'Student check-in', links.student, 'Put this QR code on tables, flyers and the entrance.')}
  ${linkCard('company', 'Company resume bank', links.company, companyTokenFromEnv
    ? 'This link comes from the COMPANY_TOKEN setting on Render. Change that setting to replace it.'
    : `Give this only to companies. <form method="post" action="/a/${t}/rotate-company" class="confirm inline" data-confirm="Make a new company link? The old link and old QR codes stop working at once."><button class="link danger" type="submit">Replace this link</button></form>`)}
</div>

<div class="card reg-link">
  <h3>Company registration form</h3>
  <p class="fine">Send this link in your emails to companies before the fair.</p>
  <div class="copy-row"><input readonly value="${h(links.register)}" aria-label="Registration form link"><button class="btn btn-small" type="button" data-copy="${h(links.register)}">Copy</button></div>
</div>

<h2 class="section-title">Exports</h2>
<div class="card btn-row">
  <a class="btn btn-primary" href="/a/${t}/export/leads.csv">Warm leads: students who want Meloy emails</a>
  <a class="btn btn-outline" href="/a/${t}/export/students.csv">All students</a>
  <a class="btn btn-outline" href="/a/${t}/export/registrations.csv">Registered companies and reps</a>
  <a class="btn btn-outline" href="/a/${t}/export/activity.csv">Activity log</a>
  <a class="btn btn-outline" href="/a/${t}/export/resumes.zip">All resumes (ZIP)</a>
</div>

<h2 class="section-title">Registered companies (${registrations.length})</h2>
<div class="card table-wrap"><table>
<thead><tr><th>Company</th><th>Contact</th><th>People coming</th><th>Majors wanted</th><th>Dietary</th><th>Registered</th></tr></thead>
<tbody>${registrationRows || '<tr><td colspan="6" class="muted">No registrations yet.</td></tr>'}</tbody></table></div>

<h2 class="section-title">Students (${students.length})</h2>
<div class="card table-wrap"><table>
<thead><tr><th>Student</th><th>Major</th><th>Meloy emails</th><th>Resume views</th><th>Link clicks</th><th>Updated</th><th></th></tr></thead>
<tbody>${studentRows || '<tr><td colspan="7" class="muted">No students yet.</td></tr>'}</tbody></table></div>

<h2 class="section-title">Stats</h2>
<div class="card stats-card">
  <dl class="stat-list">
    <dt class="stat-list-head">Fair totals</dt><dd></dd>
    ${stat(stats.students, 'Students checked in')}
    ${stat(stats.optins, 'Want Meloy emails')}
    ${stat(stats.registered, 'Companies registered')}
    ${stat(stats.reps, 'Reps coming')}
    ${stat(stats.views, 'Resume views')}
  </dl>
  <dl class="stat-list">
    <dt class="stat-list-head">Meloy link clicks</dt><dd></dd>
    ${clicks.length ? clicks.map((c) => stat(c.n, c.label)).join('') : '<dt class="muted">No clicks yet</dt><dd></dd>'}
  </dl>
</div>`;
  return layout({ title: 'Resume Bank Staff', body, wide: true, scripts: ['/admin.js'] });
}

/* ---------------- company registration (sent by email before the fair) ---------------- */

export const MAX_REPS = 4;

export function register({ values = {}, error = '' } = {}) {
  const v = values;
  const extras = v.extras || [];
  const MAX_EXTRA = MAX_REPS - 1;
  const extraCount = Math.min(Math.max(Number(v.extra_count) || 0, 0), MAX_EXTRA);
  const extraLabel = (n) => (n === 0 ? 'No, just me' : `Yes, ${n} more ${n === 1 ? 'person' : 'people'}`);
  const extraRows = Array.from({ length: MAX_EXTRA }, (_, i) => {
    const r = extras[i] || {};
    return `<div class="rep-row" data-rep="${i + 1}"${i >= extraCount ? ' hidden' : ''}>
    <span class="rep-num">${i + 2}</span>
    <input name="extra_name_${i + 1}" maxlength="80" autocomplete="off" placeholder="Full name" aria-label="Person ${i + 2} name" value="${h(r.name)}">
    <input name="extra_email_${i + 1}" type="email" maxlength="120" autocomplete="off" placeholder="Email" aria-label="Person ${i + 2} email" value="${h(r.email)}">
  </div>`;
  }).join('');

  const body = `
${hero(EVENT.name, 'Company Registration', 'Howdy! Tell us who is coming to the fair')}
<form class="card form" method="post" action="/register" novalidate>
  ${error ? `<div class="alert" role="alert">${h(error)}</div>` : ''}
  <label class="field"><span>Company</span><input name="company" required maxlength="100" autocomplete="organization" value="${h(v.company)}"></label>
  <div class="grid2">
    <label class="field"><span>Your name</span><input name="contact_name" required maxlength="80" autocomplete="name" value="${h(v.contact_name)}"></label>
    <label class="field"><span>Email</span><input name="contact_email" type="email" required maxlength="120" autocomplete="email" value="${h(v.contact_email)}"></label>
  </div>
  <label class="field"><span>Is anyone else coming with you?</span>
    <select name="extra_count" id="extra_count">${Array.from({ length: MAX_EXTRA + 1 }, (_, n) => `<option value="${n}"${n === extraCount ? ' selected' : ''}>${extraLabel(n)}</option>`).join('')}</select></label>
  <div class="reps" id="extras"${extraCount ? '' : ' hidden'}>${extraRows}</div>
  <label class="field"><span>Majors you want to meet <em>optional</em></span><input name="roles" maxlength="200" placeholder="Computer Science, Mechanical Engineering, any major" value="${h(v.roles)}"></label>

  <div class="info">
    <h2 class="form-section">At the fair</h2>
    <p><strong>We provide:</strong></p>
    <ul>${FAIR_PROVIDES.map((x) => `<li>${h(x)}</li>`).join('')}</ul>
    <p><strong>Please bring:</strong> ${h(FAIR_BRING)}</p>
  </div>

  <label class="field"><span>Dietary restrictions</span><input name="dietary" required maxlength="300" placeholder="None, or e.g. 1 vegetarian, 1 halal, 1 nut allergy" value="${h(v.dietary)}"></label>
  <button class="btn btn-primary btn-block" type="submit">Register</button>
</form>`;
  return layout({ title: 'Company Registration', body, scripts: ['/register.js'] });
}

export function registered({ company, updated }) {
  const body = `
${hero(EVENT.name, updated ? 'Registration updated' : 'You’re registered', `Thanks and gig ’em, ${company}.`)}
<section class="card">
  <p>We have your details. Before the fair, we will email the main contact with the fair details.</p>
  <p>On fair day, scan the company QR code at the check-in table to open the student resume bank.</p>
</section>`;
  return layout({ title: 'You’re registered', body });
}

export function poster({ which, url, qrSvg }) {
  const student = which === 'student';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>${student ? 'Student check-in poster' : 'Company access poster'}</title>
<link rel="stylesheet" href="/style.css"></head>
<body class="poster-body">
<div class="poster">
  <div class="poster-top">
    <div class="brand">${h(EVENT.title)}</div>
    <h1>${student ? 'Students: check in here' : 'Companies: find students'}</h1>
    <p class="hero-sub"><span>${student ? 'Scan to upload your resume to the startup resume bank' : 'Scan to open the student resume bank'}</span></p>
  </div>
  <div class="poster-qr">${qrSvg}</div>
  <p class="poster-url">${h(url.replace(/^https?:\/\//, ''))}</p>
  ${student ? '<p class="poster-note">Takes 30 seconds. Have your resume PDF ready on your phone.</p>' : '<p class="poster-note">For company representatives only. Please do not share.</p>'}
</div>
</body></html>`;
}

export function message(title, text, status = '') {
  return layout({ title, body: `${hero(status || EVENT.name, title)}<section class="card"><p>${h(text)}</p></section>` });
}
