(() => {
  const form = document.querySelector('form.form');
  if (!form) return;
  const maxBytes = Number(form.dataset.maxmb) * 1024 * 1024;
  const file = form.querySelector('input[type=file]');
  const wrap = file.closest('.file');
  const name = wrap.querySelector('.file-name');
  const button = form.querySelector('button[type=submit]');


  // Searchable major picker: type a few letters, pick from the list, or keep your own text.
  const combo = form.querySelector('.combo');
  if (combo) {
    const all = JSON.parse(combo.dataset.options);
    const input = combo.querySelector('input');
    const list = combo.querySelector('.combo-list');
    let items = [];
    let active = -1;
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const mark = (text, q) => {
      if (!q) return esc(text);
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
    };
    const score = (m, words) => {
      const n = norm(m);
      if (!words.every((w) => n.includes(w))) return -1;
      // words that start a word in the major rank first
      return words.reduce((s, w) => s + (n.startsWith(w) ? 3 : (' ' + n).includes(' ' + w) ? 2 : 0), 0);
    };
    const render = () => {
      const q = input.value.trim();
      const words = norm(q).split(' ').filter(Boolean);
      items = words.length
        ? all.map((m) => [m, score(m, words)]).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m)
        : all.slice();
      const exact = items.some((m) => m.toLowerCase() === q.toLowerCase());
      let html = items.map((m, i) => `<li role="option" id="major-opt-${i}" data-value="${esc(m)}">${mark(m, q)}</li>`).join('');
      if (q && !exact) html += `<li role="option" class="custom" id="major-opt-${items.length}" data-value="${esc(q)}">Use “${esc(q)}”</li>`;
      if (q && !exact) items.push(q);
      list.innerHTML = html || '<li class="empty">No match</li>';
      active = -1;
      open(true);
    };
    const open = (on) => {
      list.hidden = !on;
      input.setAttribute('aria-expanded', String(on));
      if (!on) input.removeAttribute('aria-activedescendant');
    };
    const highlight = (i) => {
      const opts = list.querySelectorAll('[role=option]');
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === active)));
      opts[active].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', opts[active].id);
    };
    const choose = (value) => {
      input.value = value;
      input.removeAttribute('aria-invalid');
      open(false);
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); highlight(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
      else if (e.key === 'Enter' && !list.hidden && active >= 0) { e.preventDefault(); choose(list.querySelectorAll('[role=option]')[active].dataset.value); }
      else if (e.key === 'Escape') open(false);
    });
    // mousedown, not click, so the input does not lose focus first
    list.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[role=option]');
      if (li) { e.preventDefault(); choose(li.dataset.value); }
    });
    input.addEventListener('blur', () => setTimeout(() => open(false), 120));
  }

  file.addEventListener('change', () => {
    const f = file.files[0];
    wrap.classList.toggle('has-file', Boolean(f));
    name.textContent = f ? f.name : 'Choose a PDF';
  });

  const showError = (msg, field) => {
    let box = form.querySelector('.alert');
    if (!box) {
      box = document.createElement('div');
      box.className = 'alert';
      box.setAttribute('role', 'alert');
      form.prepend(box);
    }
    box.textContent = msg;
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  form.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));

  form.addEventListener('submit', (e) => {
    const f = file.files[0];
    const fields = form.querySelectorAll('input[required]:not([type=file]):not([type=checkbox]), select[required]');
    for (const el of fields) {
      if (!el.value.trim() || !el.checkValidity()) {
        e.preventDefault();
        const label = el.closest('.field').querySelector('span').textContent;
        return showError(el.type === 'email' && el.value ? 'Enter a valid email address.' : `Fill in: ${label}.`, el);
      }
    }
    if (f && f.size > maxBytes) {
      e.preventDefault();
      return showError(`Your PDF is larger than ${form.dataset.maxmb} MB. Export a smaller PDF and try again.`);
    }
    if (f && !/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
      e.preventDefault();
      return showError('Your resume must be a PDF file.');
    }
    // No file is fine only for a returning student; the server checks that.
    button.disabled = true;
    button.textContent = 'Uploading…';
  });

  // Back button after submit: enable the button again.
  window.addEventListener('pageshow', () => {
    button.disabled = false;
    button.textContent = 'Check in and upload';
  });
})();
