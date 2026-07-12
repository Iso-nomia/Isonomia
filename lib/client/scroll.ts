// export function scrollDelibComposerIntoView() {
//   const el = document.getElementById('delib-composer-anchor');
//   if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
// }

// lib/client/scroll.ts
export function scrollIntoViewById(id: string, offset = 80) {
  const el = document.getElementById(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const alreadyVisible =
    rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
  if (alreadyVisible) return;
  const top = window.scrollY + rect.top - offset;
  window.scrollTo({ top, behavior: "smooth" });
}
