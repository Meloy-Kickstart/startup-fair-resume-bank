(() => {
  const form = document.getElementById('filters');
  const results = document.getElementById('results');
  const count = document.getElementById('count');
  const csv = document.getElementById('csv');
  const zip = document.getElementById('zip');
  const base = `/c/${encodeURIComponent(form.dataset.token)}`;
  let facetsLoaded = false;
  let timer;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

  const params = () => {
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v) p.set(k, v);
    return p;
  };

  function fillSelect(name, values, label) {
    const sel = form.elements[name];
    const current = sel.value;
    sel.innerHTML = `<option value="">${label}</option>` + values.map((v) => `<option>${esc(v)}</option>`).join('');
    sel.value = current;
  }

  function card(s) {
    const linkedin = safeUrl(s.linkedin);
    return `<article class="student">
  <h3>${esc(s.first_name)} ${esc(s.last_name)}</h3>
  <p class="meta">${esc(s.major)}${s.degree ? ` &middot; ${esc(s.degree)}` : ''} &middot; Graduates ${esc(s.grad_term)}</p>
  ${s.looking_for.length ? `<div class="tags">${s.looking_for.map((t) => `<span class="tag yes">${esc(t)}</span>`).join('')}</div>` : ''}
  <div class="contact">
    <span><a href="mailto:${esc(s.email)}">${esc(s.email)}</a> <button class="link copy" type="button" data-copy="${esc(s.email)}">Copy</button></span>
    ${s.phone ? `<span><a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}">${esc(s.phone)}</a></span>` : ''}
    ${linkedin ? `<span><a href="${esc(linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn profile</a></span>` : ''}
  </div>
  <div class="actions">
    <a class="btn btn-small btn-primary" href="${base}/resume/${s.id}" target="_blank" rel="noopener">View resume</a>
    <a class="btn btn-small btn-outline" href="${base}/resume/${s.id}?dl=1">Download</a>
  </div>
</article>`;
  }

  async function load() {
    const p = params();
    const qs = p.toString() ? `?${p}` : '';
    csv.href = `${base}/students.csv${qs}`;
    zip.href = `${base}/resumes.zip${qs}`;
    history.replaceState(null, '', `${location.pathname}${qs}`);
    try {
      const res = await fetch(`${base}/api/students${qs}`, { headers: { Accept: 'application/json' } });
      if (res.redirected || !res.ok) return location.reload();
      const data = await res.json();
      if (!facetsLoaded) {
        fillSelect('major', data.facets.majors, 'All majors');
        fillSelect('year', data.facets.years, 'Any year');
        facetsLoaded = true;
      }
      count.textContent = data.students.length;
      results.innerHTML = data.students.length
        ? data.students.map(card).join('')
        : '<p class="muted center">No students match these filters.</p>';
    } catch {
      results.innerHTML = '<p class="muted center">Could not load students. Check your connection and refresh.</p>';
    }
  }

  // keep filters from the URL, so a shared or refreshed view stays the same
  const start = new URLSearchParams(location.search);
  for (const [k, v] of start) if (form.elements[k]) form.elements[k].value = v;

  form.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(load, 200);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    load();
  });
  results.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.copy);
      b.textContent = 'Copied';
      setTimeout(() => (b.textContent = 'Copy'), 1500);
    } catch {}
  });

  load().then(() => {
    // selects are filled after the first load; apply URL values again
    for (const [k, v] of start) if (form.elements[k]) form.elements[k].value = v;
    if (start.get('major') || start.get('year')) load();
  });
})();
