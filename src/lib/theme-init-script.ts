// The inline script that runs before React hydrates to prevent a flash
// of the wrong theme. Extracted into its own module so `layout.tsx` can
// apply the per-request CSP nonce (set by `src/proxy.ts`) to the <script>
// tag without having the raw string inlined into JSX.
export const THEME_INIT_SCRIPT = `(function() {
  try {
    var stored = localStorage.getItem('mindraft-theme');
    var isDark = stored === 'dark' || ((!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {}
})();`;
