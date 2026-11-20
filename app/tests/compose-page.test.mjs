import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composePage, loadPage } from '../page.mjs';

const TEMPLATE = '<head><!-- theme:init --><!-- theme:css --></head><body><!-- theme:switch --></body>';
const fakeTheme = (file) => `/* ${file} */\n`;

test('inlines each theme file in its own tag', () => {
  assert.equal(
    composePage(TEMPLATE, fakeTheme),
    '<head><script>/* theme-init.js */</script><style>/* theme.css */</style></head><body><script>/* theme-switch.js */</script></body>',
  );
});

test('keeps `$` in theme files as-is', () => {
  assert.match(composePage(TEMPLATE, () => "a$&b$'c"), /<style>a\$&b\$'c<\/style>/);
});

test('throws when the template is missing a placeholder', () => {
  assert.throws(() => composePage('<head><!-- theme:css --></head>', fakeTheme), /theme:init/);
});

test('the real page has the theme inlined, with no placeholder left', () => {
  const page = loadPage();
  assert.doesNotMatch(page, /<!-- theme:/);
  assert.match(page, /<style>@layer theme\.tokens/);
  assert.match(page, /data-theme-switch/);
});
