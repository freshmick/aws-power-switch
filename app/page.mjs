// Builds the page: page.html with the shared theme (app/theme/, see scripts/update-theme.sh)
// inlined, so the page stays a single response with no extra routes to serve or protect.
import { readFileSync } from 'node:fs';

// Each placeholder comment in page.html is replaced by one theme file, wrapped in the given tag.
const SLOTS = [
  { placeholder: '<!-- theme:init -->', file: 'theme-init.js', tag: 'script' },
  { placeholder: '<!-- theme:css -->', file: 'theme.css', tag: 'style' },
  { placeholder: '<!-- theme:switch -->', file: 'theme-switch.js', tag: 'script' },
];

/**
 * Inlines the theme into the page template. Throws if a placeholder is missing, so a template
 * edit can't silently drop the theme.
 * readThemeFile(name) returns the contents of a file in app/theme/.
 */
export function composePage(template, readThemeFile) {
  return SLOTS.reduce((page, { placeholder, file, tag }) => {
    if (!page.includes(placeholder)) throw new Error(`page.html is missing ${placeholder}`);
    const inlined = `<${tag}>${readThemeFile(file).trim()}</${tag}>`;
    return page.replace(placeholder, () => inlined); // a function, so `$` in the theme isn't a replacement pattern
  }, template);
}

/** Reads page.html and the theme from disk and composes them. */
export function loadPage() {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  return composePage(read('./page.html'), (file) => read(`./theme/${file}`));
}
