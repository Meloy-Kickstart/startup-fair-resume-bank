(() => {
  const count = document.getElementById('extra_count');
  if (!count) return;
  const box = document.getElementById('extras');
  const rows = [...box.querySelectorAll('.rep-row')];
  const show = () => {
    const n = Number(count.value);
    box.hidden = n === 0;
    rows.forEach((r) => {
      const on = Number(r.dataset.rep) <= n;
      r.hidden = !on;
      r.querySelectorAll('input').forEach((i) => (i.required = on));
    });
  };
  count.addEventListener('change', show);
  show();
})();
