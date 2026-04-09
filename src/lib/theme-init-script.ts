// The inline script that runs before React hydrates to prevent a flash
// of the wrong theme. Exported as a constant so `next.config.ts` can
// compute its SHA-256 hash at build time for a strict CSP `script-src`.
//
// IMPORTANT: the hash in the CSP header is computed from this exact
// string. Any change (including whitespace) requires regenerating the
// hash — next.config.ts does this automatically on build.
export const THEME_INIT_SCRIPT = `(function() {
  try {
    var stored = localStorage.getItem('mindraft-theme');
    var isDark = stored === 'dark' || ((!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {}
})();`;
