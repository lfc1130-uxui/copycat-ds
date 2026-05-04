#!/usr/bin/env node
/**
 * sync-docs.js
 *
 * Patches inline-embedded source data in index.html and figma-plugin/ui.html
 * from their canonical source files, so the doc site and plugin stay in sync.
 *
 * Usage:
 *   node scripts/sync-docs.js           — patch all targets
 *   node scripts/sync-docs.js --dry-run — preview diffs without writing
 *   node scripts/sync-docs.js tokens    — patch only the tokens block
 *
 * Sync targets:
 *   tokens        src/styles/tokens.css              → index.html :root {}
 *   tokens-json   src/styles/tokens.css              → tokens/tokens.json  ← Figma plugin variables import
 *   button-css    src/components/Button/Button.css   → index.html button block
 *   badge-css     src/components/Badge/Badge.css     → index.html badge block
 *   icon-json     src/components/Icon/icons.ts       → components/icon.json  ← canonical Figma schema
 *   icon-paths    src/components/Icon/icons.ts       → index.html ICON_PATHS
 *   icon-examples components/icon.json              → figma-plugin/ui.html EXAMPLES.icon
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const TARGETS = process.argv.filter(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function write(rel, content) {
  const abs = path.join(ROOT, rel);
  if (DRY_RUN) {
    console.log(`[dry-run] would write ${rel}`);
    return;
  }
  fs.writeFileSync(abs, content, 'utf8');
  console.log(`  wrote  ${rel}`);
}

/**
 * Replace the content between sync-start and sync-end markers in a file.
 * Marker format in CSS:  /* sync-start:NAME *\/  ... /* sync-end:NAME *\/
 * Marker format in JS:   // sync-start:NAME       ... // sync-end:NAME
 */
function patch(fileContent, name, replacement) {
  // Match both CSS (/* … */) and JS (//) style markers
  const cssRe = new RegExp(
    `(/\\* sync-start:${name} \\*/)([\\s\\S]*?)(/\\* sync-end:${name} \\*/)`,
    'g'
  );
  const jsRe = new RegExp(
    `(// sync-start:${name})([\\s\\S]*?)(// sync-end:${name})`,
    'g'
  );

  let patched = fileContent;
  let found = false;

  if (cssRe.test(fileContent)) {
    patched = fileContent.replace(cssRe, `$1\n${replacement}\n    $3`);
    found = true;
  }
  if (jsRe.test(fileContent)) {
    patched = patched.replace(jsRe, `$1\n${replacement}\n    $3`);
    found = true;
  }

  if (!found) {
    throw new Error(`Sync marker "sync-start:${name}" not found`);
  }
  return patched;
}

// ── tokens.json builder ───────────────────────────────────────────────────────

/**
 * Parse all CSS custom properties out of a single CSS block (between the braces).
 * Returns a plain object: { 'blue-500': '#0068ff', 'color-brand': 'var(--blue-500)', ... }
 */
function parseCssVars(block) {
  const vars = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

/**
 * Convert a CSS var reference like "var(--blue-500)" to a Token Studio alias
 * like "{blue.500}". Only works for primitive references (ends in a number).
 * Returns null if the value is not a recognisable primitive alias.
 */
function cssVarToAlias(value) {
  const m = value.match(/^var\(--([a-z0-9-]+)\)$/);
  if (!m) return null;
  const parts = m[1].split('-');
  if (!/^\d+$/.test(parts[parts.length - 1])) return null;
  const colorName = parts.slice(0, -1).join('-');
  const number    = parts[parts.length - 1];
  return `{${colorName}.${number}}`;
}

/**
 * Build tokens/tokens.json from tokens.css.
 *
 * Output structure (consumed by the Figma plugin Variables tab):
 *   {
 *     primitives:      { blue: { '500': { value: '#0068ff', type: 'color' } }, ... },
 *     'semantic/light': { 'color/brand': { value: '{blue.500}', type: 'color' }, ... },
 *     'semantic/dark':  { 'color/brand': { value: '{blue.400}', type: 'color' }, ... }
 *   }
 *
 * Token path → Figma variable name: dots replaced with slashes inside code.js.
 * For primitives we use nested JSON (blue.500 → blue/500).
 * For semantics we use flat slash-keyed JSON (color/brand/hover stays as-is).
 */
function buildTokensJson(tokensCss) {
  const rootBlock = (tokensCss.match(/:root\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
  const darkBlock = (tokensCss.match(/\.dark\s*\{([\s\S]*?)\n\}/)  || [])[1] || '';

  const rootVars = parseCssVars(rootBlock);
  const darkVars = parseCssVars(darkBlock);

  const PRIMITIVE_NAMES = ['blue', 'neutral', 'green', 'amber', 'red'];

  // ── PRIMITIVES ────────────────────────────────────────────────────────────
  const primitives = {};
  for (const [name, value] of Object.entries(rootVars)) {
    const parts = name.split('-');
    if (!PRIMITIVE_NAMES.includes(parts[0])) continue;
    if (!/^\d+$/.test(parts[parts.length - 1])) continue;
    const colorName = parts.slice(0, -1).join('-');
    const number    = parts[parts.length - 1];
    if (!primitives[colorName]) primitives[colorName] = {};
    primitives[colorName][number] = { value, type: 'color' };
  }

  // ── SEMANTIC LIGHT ────────────────────────────────────────────────────────
  const semanticLight = {};
  for (const [name, value] of Object.entries(rootVars)) {
    if (!name.startsWith('color-')) continue;
    const tokenPath = name.replace(/-/g, '/');                // color/brand/hover
    const alias     = cssVarToAlias(value);
    if (alias) {
      semanticLight[tokenPath] = { value: alias, type: 'color' };
    } else if (value.startsWith('#') || value.startsWith('rgb')) {
      semanticLight[tokenPath] = { value, type: 'color' };
    }
  }

  // ── SEMANTIC DARK ─────────────────────────────────────────────────────────
  const semanticDark = {};
  for (const [name, value] of Object.entries(darkVars)) {
    if (!name.startsWith('color-')) continue;
    const tokenPath = name.replace(/-/g, '/');
    const alias     = cssVarToAlias(value);
    if (alias) {
      semanticDark[tokenPath] = { value: alias, type: 'color' };
    } else if (value.startsWith('#') || value.startsWith('rgb')) {
      semanticDark[tokenPath] = { value, type: 'color' };
    }
  }

  return { primitives, 'semantic/light': semanticLight, 'semantic/dark': semanticDark };
}

// ── CSS minifier (strips comments, collapses whitespace) ──────────────────────

function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')       // strip block comments
    .replace(/\s*:\s*/g, ':')               // remove spaces around colons
    .replace(/\s*;\s*/g, ';')               // remove spaces around semicolons
    .replace(/\s*\{\s*/g, '{')              // remove spaces around {
    .replace(/\s*\}\s*/g, '}')             // remove spaces around }
    .replace(/\s*,\s*/g, ',')              // remove spaces around commas
    .replace(/[ \t]+/g, ' ')               // collapse horizontal whitespace
    .replace(/\n\s*\n/g, '\n')             // collapse blank lines
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n    ');                        // indent to match index.html style
}

// ── Source parsers ────────────────────────────────────────────────────────────

/**
 * Extract the :root { ... } block from tokens.css, minify it,
 * keeping the closing } on its own line to match the existing format.
 */
function buildTokensBlock(tokensCss) {
  const rootMatch = tokensCss.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) throw new Error('Could not find :root block in tokens.css');
  const inner = minifyCSS(rootMatch[1]);
  return `    :root {\n      ${inner}\n    }`;
}

/**
 * Read a component CSS file and return it minified, indented for index.html.
 */
function buildComponentCSS(css) {
  return '    ' + minifyCSS(css);
}

/**
 * Parse icons.ts and return an array of { name, svg } objects.
 * Works by extracting key:'value' pairs from the icons object literal.
 */
function parseIcons(iconsTs) {
  const icons = [];
  // Match 'icon-name': '...' — handles both single and double quoted values
  const re = /'([^']+)'\s*:\s*'([\s\S]*?)',?\s*(?=\n\s*(?:'|\/\/|}))/g;
  let m;
  while ((m = re.exec(iconsTs)) !== null) {
    icons.push({ name: m[1], svg: m[2] });
  }
  if (icons.length === 0) throw new Error('No icons found in icons.ts');
  return icons;
}

/**
 * Build the ICON_PATHS JS object literal for index.html.
 * Uses double-quoted attribute values to match the existing style.
 */
function buildIconPaths(icons) {
  const maxLen = Math.max(...icons.map(({ name }) => name.length));
  const lines = icons.map(({ name, svg }) => {
    const pad = ' '.repeat(maxLen - name.length + 1);
    return `      '${name}'${pad}: '${svg}'`;
  });
  return `    var ICON_PATHS = {\n${lines.join(',\n')}\n    };`;
}

/**
 * Build components/icon.json — canonical Figma plugin schema for the icon set.
 * SVG attribute values use single quotes (valid SVG, avoids JSON escaping).
 */
function buildIconJson(icons) {
  const entries = icons.map(({ name, svg }) => {
    const svgSingle = svg.replace(/"/g, "'");
    return `    { "name": "${name}", "svg": "${svgSingle}" }`;
  });
  return `{\n  "name": "Icon",\n  "type": "icon-set",\n  "icons": [\n${entries.join(',\n')}\n  ]\n}\n`;
}

/**
 * Build the icon entries array for EXAMPLES.icon in ui.html from icon.json icons.
 * Keeps single-quoted SVG attributes (already converted in icon.json).
 */
function buildIconExamples(icons) {
  const lines = icons.map(({ name, svg }) => {
    return `          { "name": "${name}", "svg": "${svg}" }`;
  });
  return lines.join(',\n');
}

// ── Sync tasks ────────────────────────────────────────────────────────────────

const TASKS = {

  tokens() {
    const tokensCss = read('src/styles/tokens.css');
    const replacement = buildTokensBlock(tokensCss);
    let html = read('index.html');
    html = patch(html, 'tokens', replacement);
    write('index.html', html);
    console.log('  tokens → index.html');
  },

  'tokens-json'() {
    const tokensCss = read('src/styles/tokens.css');
    const tokensJson = buildTokensJson(tokensCss);
    // Ensure tokens/ directory exists
    const tokensDir = path.join(ROOT, 'tokens');
    if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir);
    write('tokens/tokens.json', JSON.stringify(tokensJson, null, 2) + '\n');
    const semCount = Object.keys(tokensJson['semantic/light']).length;
    const primCount = Object.values(tokensJson.primitives).reduce((n, g) => n + Object.keys(g).length, 0);
    console.log(`  tokens.css → tokens/tokens.json  (${primCount} primitives, ${semCount} semantic tokens)`);
  },

  'button-css'() {
    const css = read('src/components/Button/Button.css');
    const replacement = buildComponentCSS(css);
    let html = read('index.html');
    html = patch(html, 'button-css', replacement);
    write('index.html', html);
    console.log('  button-css → index.html');
  },

  'badge-css'() {
    const css = read('src/components/Badge/Badge.css');
    const replacement = buildComponentCSS(css);
    let html = read('index.html');
    html = patch(html, 'badge-css', replacement);
    write('index.html', html);
    console.log('  badge-css → index.html');
  },

  'input-css'() {
    const css = read('src/components/Input/Input.css');
    const replacement = buildComponentCSS(css);
    let html = read('index.html');
    html = patch(html, 'input-css', replacement);
    write('index.html', html);
    console.log('  input-css → index.html');
  },

  'icon-json'() {
    const iconsTs = read('src/components/Icon/icons.ts');
    const icons = parseIcons(iconsTs);
    write('components/icon.json', buildIconJson(icons));
    console.log(`  icons.ts → components/icon.json  (${icons.length} icons)`);
  },

  'icon-paths'() {
    const iconsTs = read('src/components/Icon/icons.ts');
    const icons = parseIcons(iconsTs);
    const replacement = buildIconPaths(icons);
    let html = read('index.html');
    html = patch(html, 'icon-paths', replacement);
    write('index.html', html);
    console.log(`  icons.ts → index.html ICON_PATHS  (${icons.length} icons)`);
  },

  'icon-examples'() {
    const iconJson = JSON.parse(read('components/icon.json'));
    const icons = iconJson.icons;
    const replacement = buildIconExamples(icons);
    let uiHtml = read('figma-plugin/ui.html');
    uiHtml = patch(uiHtml, 'icon-examples', replacement);
    write('figma-plugin/ui.html', uiHtml);
    console.log(`  components/icon.json → figma-plugin/ui.html  (${icons.length} icons)`);
  },
};

// ── Runner ────────────────────────────────────────────────────────────────────

// Explicit order ensures icon-json runs before icon-examples
const allTargets  = ['tokens', 'tokens-json', 'button-css', 'badge-css', 'input-css', 'icon-json', 'icon-paths', 'icon-examples'];
const runTargets  = TARGETS.length ? TARGETS : allTargets;
const badTargets  = runTargets.filter(t => !TASKS[t]);

if (badTargets.length) {
  console.error(`Unknown target(s): ${badTargets.join(', ')}`);
  console.error(`Valid targets: ${allTargets.join(', ')}`);
  process.exit(1);
}

console.log(DRY_RUN ? '[dry-run mode]' : 'Syncing...');
let errors = 0;
for (const name of runTargets) {
  try {
    TASKS[name]();
  } catch (e) {
    console.error(`  ERROR [${name}]: ${e.message}`);
    errors++;
  }
}
console.log(errors ? `\nDone with ${errors} error(s).` : '\nAll targets synced.');
process.exit(errors ? 1 : 0);
