/**
 * Inline script to apply the theme class before React hydration.
 * This prevents the flash of wrong theme (FOWT).
 *
 * This string is injected as a <script> tag in the root layout.
 * It must be self-contained (no imports, no framework dependencies).
 */
export const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('symbio-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldBeDark = theme === 'dark' || (theme !== 'light' && prefersDark);

    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;
