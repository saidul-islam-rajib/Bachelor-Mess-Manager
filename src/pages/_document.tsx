import { Html, Head, Main, NextScript } from 'next/document';

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var match = document.cookie.match(/(?:^|; )bachelor_point_theme=([^;]*)/);
    var cookieTheme = match ? decodeURIComponent(match[1]) : null;
    var theme = (cookieTheme === 'light' || cookieTheme === 'dark' || cookieTheme === 'system')
      ? cookieTheme
      : (localStorage.getItem('theme') || 'system');
    var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
