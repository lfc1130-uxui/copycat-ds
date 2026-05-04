#!/usr/bin/env node
/**
 * convert-tokens.js
 *
 * Converts CSS custom properties from foundations.html into a
 * Tokens Studio–compatible JSON file (tokens/tokens.json).
 *
 * Output structure
 * ────────────────
 *   primitives      → raw color scales + all non-semantic foundations
 *   semantic/light  → --color-* aliases for light mode
 *   semantic/dark   → --color-* overrides for dark mode
 *
 * Usage
 * ─────
 *   node scripts/convert-tokens.js
 */

const fs   = require('fs');
const path = require('path');

const INPUT  = path.resolve(__dirname, '../foundations.html');
const OUTPUT = path.resolve(__dirname, '../tokens/tokens.json');

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXTRACT A CSS BLOCK BY SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds `selector { ... }` in a CSS string and returns the inner content.
 * Handles the block by tracking brace depth (no nested-brace issues).
 */
function extractBlock(css, selector) {
  const idx = css.indexOf(selector);
  if (idx === -1) return '';
  const open = css.indexOf('{', idx);
  if (open === -1) return '';
  let depth = 0, i = open;
  while (i < css.length) {
    if      (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) return css.slice(open + 1, i); }
    i++;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PARSE CSS CUSTOM PROPERTIES  →  { varName: value }
// ─────────────────────────────────────────────────────────────────────────────

function parseCSSVars(block) {
  const vars  = {};
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments
  const re    = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. VAR NAME  →  DOT-SEPARATED TOKEN PATH
// ─────────────────────────────────────────────────────────────────────────────

function getTokenPath(name) {
  // ── Primitive color scales: blue-50, neutral-0, green-500 …
  const prim = name.match(/^(blue|neutral|green|amber|red)-(\S+)$/);
  if (prim) return `color.${prim[1]}.${prim[2]}`;

  // ── Semantic colors: color-bg-page, color-brand-hover …
  if (name.startsWith('color-')) {
    const rest  = name.slice(6);           // strip "color-"
    const parts = rest.split('-');
    return `color.${parts.join('.')}`;
  }

  // ── Typography
  if (name.startsWith('font-'))     return `typography.fontFamily.${name.slice(5)}`;
  if (name.startsWith('text-'))     return `typography.fontSize.${name.slice(5)}`;
  if (name.startsWith('weight-'))   return `typography.fontWeight.${name.slice(7)}`;
  if (name.startsWith('leading-'))  return `typography.lineHeight.${name.slice(8)}`;
  if (name.startsWith('tracking-')) return `typography.letterSpacing.${name.slice(9)}`;

  // ── Spacing
  if (name.startsWith('space-'))    return `spacing.${name.slice(6)}`;

  // ── Border radius
  if (name.startsWith('radius-'))   return `borderRadius.${name.slice(7)}`;

  // ── Shadows
  if (name.startsWith('shadow-'))   return `boxShadow.${name.slice(7)}`;

  // ── Border width
  if (name.startsWith('border-'))   return `borderWidth.${name.slice(7)}`;

  // ── Z-index
  if (name.startsWith('z-'))        return `zIndex.${name.slice(2)}`;

  // ── Animation
  if (name.startsWith('ease-'))     return `animation.easing.${name.slice(5)}`;
  if (name.startsWith('duration-')) return `animation.duration.${name.slice(9)}`;

  return name; // fallback: keep as-is
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TOKEN TYPE  (Tokens Studio type strings)
// ─────────────────────────────────────────────────────────────────────────────

function getTokenType(name) {
  if (/^(blue|neutral|green|amber|red)-/.test(name)) return 'color';
  if (name.startsWith('color-'))    return 'color';
  if (name.startsWith('font-'))     return 'fontFamilies';
  if (name.startsWith('text-'))     return 'fontSizes';
  if (name.startsWith('weight-'))   return 'fontWeights';
  if (name.startsWith('leading-'))  return 'lineHeights';
  if (name.startsWith('tracking-')) return 'letterSpacing';
  if (name.startsWith('space-'))    return 'spacing';
  if (name.startsWith('radius-'))   return 'borderRadius';
  if (name.startsWith('shadow-'))   return 'boxShadow';
  if (name.startsWith('border-'))   return 'borderWidth';
  if (name.startsWith('z-'))        return 'other';
  if (name.startsWith('ease-'))     return 'other';
  if (name.startsWith('duration-')) return 'other';
  return 'other';
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. RESOLVE  var(--name)  →  {token.path}  REFERENCES
// ─────────────────────────────────────────────────────────────────────────────

function resolveValue(value, varToPath) {
  // Simple single var(): var(--blue-500)
  const single = value.match(/^var\(--([a-zA-Z0-9-]+)\)$/);
  if (single && varToPath[single[1]]) {
    return `{${varToPath[single[1]]}}`;
  }
  // rgba() literals and multi-token values are kept as-is
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SHADOW PARSER  →  Tokens Studio boxShadow object / array
// ─────────────────────────────────────────────────────────────────────────────

function parseShadowLayer(raw) {
  const str     = raw.trim();
  const isInset = str.startsWith('inset');
  const rest    = isInset ? str.slice(5).trim() : str;

  // Pull out rgba/rgb color (may contain commas, so extract before splitting)
  const colorMatch = rest.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]{3,8})/);
  const color      = colorMatch ? colorMatch[1] : 'rgba(0,0,0,0)';
  const nums       = rest.replace(colorMatch ? colorMatch[0] : '', '')
                         .trim()
                         .split(/\s+/)
                         .filter(Boolean);

  return {
    x:      (nums[0] ?? '0').replace('px', ''),
    y:      (nums[1] ?? '0').replace('px', ''),
    blur:   (nums[2] ?? '0').replace('px', ''),
    spread: (nums[3] ?? '0').replace('px', ''),
    color,
    type: isInset ? 'innerShadow' : 'dropShadow',
  };
}

/**
 * Split a shadow shorthand on top-level commas
 * (avoids splitting inside rgba(r, g, b, a)).
 */
function splitShadowLayers(value) {
  const layers = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if      (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === ',' && depth === 0) {
      layers.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  layers.push(value.slice(start).trim());
  return layers;
}

function parseShadowValue(value) {
  if (value === 'none') return 'none';
  const layers  = splitShadowLayers(value).map(parseShadowLayer);
  return layers.length === 1 ? layers[0] : layers;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SET A DEEP NESTED VALUE  (dot path  →  nested object)
// ─────────────────────────────────────────────────────────────────────────────

function setDeep(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. BUILD A FULL TOKEN SET FROM A vars MAP
// ─────────────────────────────────────────────────────────────────────────────

function buildTokenSet(vars, varToPath, filter) {
  const set = {};

  for (const [name, rawValue] of Object.entries(vars)) {
    if (!filter(name)) continue;

    const tokenPath = getTokenPath(name);
    const type      = getTokenType(name);

    let value;
    if (type === 'boxShadow') {
      value = parseShadowValue(rawValue);
    } else {
      value = resolveValue(rawValue, varToPath);
    }

    setDeep(set, tokenPath, { value, type });
  }

  return set;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. COUNT LEAF TOKENS (for summary)
// ─────────────────────────────────────────────────────────────────────────────

function countTokens(node) {
  if (node && typeof node === 'object' && 'value' in node) return 1;
  return Object.values(node ?? {}).reduce((acc, v) => acc + countTokens(v), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  // ── Read source
  if (!fs.existsSync(INPUT)) {
    console.error(`ERROR: cannot find ${INPUT}`);
    process.exit(1);
  }
  const html = fs.readFileSync(INPUT, 'utf-8');

  // ── Extract <style> content
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleMatch) { console.error('ERROR: no <style> block found'); process.exit(1); }
  const css = styleMatch[1];

  // ── Parse :root and .dark blocks
  const rootVars = parseCSSVars(extractBlock(css, ':root'));
  const darkVars = parseCSSVars(extractBlock(css, '.dark'));

  if (!Object.keys(rootVars).length) {
    console.error('ERROR: no CSS variables found in :root {}');
    process.exit(1);
  }

  // ── Build var-name → token-path lookup (used for resolving var() refs)
  const varToPath = {};
  for (const name of Object.keys(rootVars)) {
    varToPath[name] = getTokenPath(name);
  }

  // ── Filter helpers
  const isPrimitive = (n) =>
    /^(blue|neutral|green|amber|red)-/.test(n) ||
    n.startsWith('font-')     ||
    n.startsWith('text-')     ||
    n.startsWith('weight-')   ||
    n.startsWith('leading-')  ||
    n.startsWith('tracking-') ||
    n.startsWith('space-')    ||
    n.startsWith('radius-')   ||
    n.startsWith('shadow-')   ||
    n.startsWith('border-')   ||
    n.startsWith('z-')        ||
    n.startsWith('ease-')     ||
    n.startsWith('duration-');

  const isSemantic = (n) => n.startsWith('color-');

  // ── Build token sets
  const primitives    = buildTokenSet(rootVars, varToPath, isPrimitive);
  const semanticLight = buildTokenSet(rootVars, varToPath, isSemantic);
  const semanticDark  = buildTokenSet(darkVars,  varToPath, isSemantic);

  // ── Assemble Tokens Studio output
  const output = {
    $metadata: {
      tokenSetOrder: ['primitives', 'semantic/light', 'semantic/dark'],
    },

    // $themes tells Tokens Studio which sets to activate per mode
    $themes: [
      {
        id:   'light',
        name: 'Light',
        group: 'Mode',
        selectedTokenSets: {
          primitives:       'enabled',
          'semantic/light': 'enabled',
          'semantic/dark':  'disabled',
        },
      },
      {
        id:   'dark',
        name: 'Dark',
        group: 'Mode',
        selectedTokenSets: {
          primitives:       'enabled',
          'semantic/light': 'disabled',
          'semantic/dark':  'enabled',
        },
      },
    ],

    primitives,
    'semantic/light': semanticLight,
    'semantic/dark':  semanticDark,
  };

  // ── Write output
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');

  // ── Summary
  const primCount  = countTokens(primitives);
  const lightCount = countTokens(semanticLight);
  const darkCount  = countTokens(semanticDark);

  console.log('');
  console.log('✓ tokens.json written →', OUTPUT);
  console.log('');
  console.log('  Token sets');
  console.log('  ──────────────────────────────');
  console.log(`  primitives        ${String(primCount).padStart(4)} tokens`);
  console.log(`  semantic/light    ${String(lightCount).padStart(4)} tokens`);
  console.log(`  semantic/dark     ${String(darkCount).padStart(4)} tokens`);
  console.log(`  ──────────────────────────────`);
  console.log(`  total             ${String(primCount + lightCount + darkCount).padStart(4)} tokens`);
  console.log('');
  console.log('  Import tokens/tokens.json into Tokens Studio in Figma.');
  console.log('  (Plugin → Load from file / Sync → point to this file)');
  console.log('');
}

main();
