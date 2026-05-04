// Copycat — Import Variables + Text Styles
// Figma Plugin: creates Variable collections and Text Styles from tokens.json

figma.showUI(__html__, { width: 340, height: 480, title: 'Copycat — Import' });

// ---------------------------------------------------------------------------
// MESSAGING HELPERS
// ---------------------------------------------------------------------------

function logVars(text, level) { figma.ui.postMessage({ type: 'log-vars', text: text, level: level }); }
function logTs(text, level)   { figma.ui.postMessage({ type: 'log-ts',   text: text, level: level }); }
function logComp(text, level) { figma.ui.postMessage({ type: 'log-comp', text: text, level: level }); }
function logTpl(text, level)  { figma.ui.postMessage({ type: 'log-tpl',  text: text, level: level }); }

// ---------------------------------------------------------------------------
// FLATTEN: nested token object -> flat array of { path, value, tokenType }
// ---------------------------------------------------------------------------

function flatten(obj, prefix) {
  prefix = prefix || '';
  var result = [];
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var key  = keys[i];
    var val  = obj[key];
    var path = prefix ? prefix + '.' + key : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && 'value' in val) {
      result.push({ path: path, value: val.value, tokenType: val.type });
    } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      var children = flatten(val, path);
      for (var j = 0; j < children.length; j++) { result.push(children[j]); }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// COLOR PARSING: hex / rgba -> { r, g, b, a } in 0-1 range
// ---------------------------------------------------------------------------

function hexToRgba(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) { hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; }
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
    a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
  };
}

function rgbaStringToRgba(str) {
  var m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return {
    r: parseFloat(m[1]) / 255,
    g: parseFloat(m[2]) / 255,
    b: parseFloat(m[3]) / 255,
    a: m[4] !== undefined ? parseFloat(m[4]) : 1
  };
}

function parseColor(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('#'))   return hexToRgba(value);
  if (value.startsWith('rgb')) return rgbaStringToRgba(value);
  return null;
}

// ---------------------------------------------------------------------------
// VARIABLE TYPE + VALUE HELPERS
// ---------------------------------------------------------------------------

function figmaVarType(tokenType, path) {
  switch (tokenType) {
    case 'color':        return 'COLOR';
    case 'fontSizes':    return 'FLOAT';
    case 'fontWeights':  return 'FLOAT';
    case 'lineHeights':  return 'FLOAT';
    case 'fontFamilies': return 'STRING';
    case 'spacing':      return 'FLOAT';
    case 'borderRadius': return 'FLOAT';
    case 'borderWidth':  return 'FLOAT';
    case 'other':
      if (path.indexOf('animation.duration') === 0) return 'FLOAT';
      if (path.indexOf('animation.easing')   === 0) return 'STRING';
      if (path.indexOf('zIndex')             === 0) return 'FLOAT';
      return null;
    default: return null;
  }
}

function figmaVarValue(token) {
  var v = String(token.value);
  switch (token.tokenType) {
    case 'color':        return parseColor(v);
    case 'fontSizes':
    case 'spacing':
    case 'borderRadius':
    case 'borderWidth':  return parseFloat(v.replace('px', ''));
    case 'fontWeights':
    case 'lineHeights':  return parseFloat(v);
    case 'fontFamilies': return v.split(',')[0].replace(/['"]/g, '').trim();
    case 'other':
      if (token.path.indexOf('animation.duration') === 0) return parseFloat(v.replace('ms', ''));
      if (token.path.indexOf('animation.easing')   === 0) return v;
      if (token.path.indexOf('zIndex')             === 0) return parseFloat(v);
      return null;
  }
  return null;
}

function getAlias(value) {
  if (typeof value !== 'string') return null;
  var m = value.match(/^\{(.+)\}$/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// SHARED HELPERS (used by export handlers)
// ---------------------------------------------------------------------------

function toDot(name) { return name.replace(/\//g, '.'); }

function toHex(c) {
  var r = Math.round(c.r * 255);
  var g = Math.round(c.g * 255);
  var b = Math.round(c.b * 255);
  var h = function(n) { return n.toString(16).padStart(2, '0'); };
  return (c.a !== undefined && c.a < 0.9999)
    ? '#' + h(r) + h(g) + h(b) + h(Math.round(c.a * 255))
    : '#' + h(r) + h(g) + h(b);
}

// Resolve a fill paint to { token, hex } — token is "{dot.path}" if variable-bound
function resolvePaint(paint, varById) {
  if (!paint || paint.type !== 'SOLID') return null;
  var hex = toHex(paint.color);
  if (paint.boundVariables && paint.boundVariables.color) {
    var v = varById[paint.boundVariables.color.id];
    if (v) return { token: toDot(v.name), hex: hex };
  }
  return { token: null, hex: hex };
}

// ---------------------------------------------------------------------------
// HANDLE MESSAGES
// ---------------------------------------------------------------------------

figma.ui.onmessage = async function(msg) {

  if (msg.type === 'cancel') { figma.closePlugin(); return; }

  if (msg.type === 'resize') {
    figma.ui.resize(340, Math.min(Math.max(msg.height, 400), 640));
    return;
  }

  // ── VARIABLES ─────────────────────────────────────────────────────────────
  if (msg.type === 'run-variables') {
    try {
      var tokens      = msg.tokens;
      var primTokens  = flatten(tokens.primitives         || {});
      var lightTokens = flatten(tokens['semantic/light']  || {});
      var darkTokens  = flatten(tokens['semantic/dark']   || {});

      logVars(primTokens.length + ' primitive tokens, ' +
              lightTokens.length + ' light, ' + darkTokens.length + ' dark');

      // Remove existing collections with same names
      var existing = figma.variables.getLocalVariableCollections();
      for (var i = 0; i < existing.length; i++) {
        if (existing[i].name === 'Primitives' || existing[i].name === 'Semantic') {
          existing[i].remove();
          logVars('Removed existing: ' + existing[i].name, 'warn');
        }
      }

      // PRIMITIVES COLLECTION
      logVars('Creating Primitives...', 'info');
      var primCol  = figma.variables.createVariableCollection('Primitives');
      var primMode = primCol.modes[0].modeId;
      primCol.renameMode(primMode, 'Default');

      var pathToVar   = {};
      var primCreated = 0;
      var primSkipped = 0;

      for (var i = 0; i < primTokens.length; i++) {
        var token  = primTokens[i];
        var fType  = figmaVarType(token.tokenType, token.path);
        if (!fType) { primSkipped++; continue; }
        if (typeof token.value !== 'string' && typeof token.value !== 'number') { primSkipped++; continue; }

        var fVal = figmaVarValue(token);
        if (fVal === null || fVal === undefined) { primSkipped++; continue; }

        try {
          var v = figma.variables.createVariable(token.path.replace(/\./g, '/'), primCol, fType);
          v.setValueForMode(primMode, fVal);
          pathToVar[token.path] = v;
          primCreated++;
        } catch (e) { primSkipped++; }
      }

      logVars('Primitives: ' + primCreated + ' created, ' + primSkipped + ' skipped');

      // SEMANTIC COLLECTION
      logVars('Creating Semantic...', 'info');
      var semCol    = figma.variables.createVariableCollection('Semantic');
      var lightMode = semCol.modes[0].modeId;
      semCol.renameMode(lightMode, 'Light');
      var darkMode  = semCol.addMode('Dark');

      var semPathToVar = {};

      for (var i = 0; i < lightTokens.length; i++) {
        var token = lightTokens[i];
        if (token.tokenType !== 'color') continue;
        try {
          var v = figma.variables.createVariable(token.path.replace(/\./g, '/'), semCol, 'COLOR');
          semPathToVar[token.path] = v;
        } catch (e) { logVars('Skip ' + token.path + ': ' + e.message, 'warn'); }
      }

      var lightSet = 0;
      for (var i = 0; i < lightTokens.length; i++) {
        var token = lightTokens[i]; var v = semPathToVar[token.path];
        if (!v) continue;
        var alias = getAlias(token.value);
        if (alias && pathToVar[alias]) {
          v.setValueForMode(lightMode, figma.variables.createVariableAlias(pathToVar[alias])); lightSet++;
        } else {
          var color = parseColor(String(token.value));
          if (color) { v.setValueForMode(lightMode, color); lightSet++; }
        }
      }

      var darkSet = 0;
      for (var i = 0; i < darkTokens.length; i++) {
        var token = darkTokens[i]; var v = semPathToVar[token.path];
        if (!v) continue;
        var alias = getAlias(token.value);
        if (alias && pathToVar[alias]) {
          v.setValueForMode(darkMode, figma.variables.createVariableAlias(pathToVar[alias])); darkSet++;
        } else {
          var color = parseColor(String(token.value));
          if (color) { v.setValueForMode(darkMode, color); darkSet++; }
        }
      }

      logVars('Semantic: ' + Object.keys(semPathToVar).length + ' vars');
      logVars('Light: ' + lightSet + ' values  |  Dark: ' + darkSet + ' values');

      figma.ui.postMessage({ type: 'done-vars' });

    } catch (e) {
      figma.ui.postMessage({ type: 'error-vars', text: e.message });
    }
    return;
  }

  // ── TEXT STYLES ──────────────────────────────────────────────────────────
  if (msg.type === 'run-text-styles') {
    try {
      var styles = msg.styles;

      logTs(styles.length + ' text styles to create');

      // Collect unique fonts that need loading
      var fontsNeeded = {};
      for (var i = 0; i < styles.length; i++) {
        var key = styles[i].family + '|' + styles[i].weight;
        fontsNeeded[key] = { family: styles[i].family, style: styles[i].weight };
      }

      // Load all fonts (required before setting fontName on a TextStyle)
      logTs('Loading fonts...', 'info');
      var fontKeys = Object.keys(fontsNeeded);
      var loadErrors = [];

      for (var i = 0; i < fontKeys.length; i++) {
        var font = fontsNeeded[fontKeys[i]];
        try {
          await figma.loadFontAsync({ family: font.family, style: font.style });
          logTs('Loaded: ' + font.family + ' ' + font.style);
        } catch (e) {
          loadErrors.push(font.family + ' ' + font.style);
          logTs('Font not found: ' + font.family + ' ' + font.style + ' — style will be skipped', 'warn');
        }
      }

      // Get existing text styles for upsert (update if name matches)
      var existingStyles = figma.getLocalTextStyles();
      function findExisting(name) {
        for (var i = 0; i < existingStyles.length; i++) {
          if (existingStyles[i].name === name) return existingStyles[i];
        }
        return null;
      }

      var created = 0;
      var updated = 0;
      var skipped = 0;

      for (var i = 0; i < styles.length; i++) {
        var s       = styles[i];
        var fontKey = s.family + '|' + s.weight;

        // Skip if font failed to load
        if (loadErrors.indexOf(s.family + ' ' + s.weight) !== -1) { skipped++; continue; }

        try {
          var existing = findExisting(s.name);
          var style    = existing || figma.createTextStyle();
          var isNew    = !existing;

          style.name        = s.name;
          style.fontName    = { family: s.family, style: s.weight };
          style.fontSize    = s.size;

          // lineHeight: multiplier -> PERCENT (e.g. 1.5 -> 150)
          style.lineHeight  = { unit: 'PERCENT', value: Math.round(s.lineHeight * 100) };

          // letterSpacing: em -> PERCENT (e.g. -0.02 -> -2)
          style.letterSpacing = { unit: 'PERCENT', value: s.letterSpacing * 100 };

          if (s.description) { style.description = s.description; }

          if (isNew) created++; else updated++;

        } catch (e) {
          logTs('Error on ' + s.name + ': ' + e.message, 'err');
          skipped++;
        }
      }

      logTs('');
      logTs('Created: ' + created + '  Updated: ' + updated + '  Skipped: ' + skipped);

      figma.ui.postMessage({ type: 'done-ts' });

    } catch (e) {
      figma.ui.postMessage({ type: 'error-ts', text: e.message });
    }
    return;
  }

  // ── COMPONENT SET — JSON-SCHEMA DRIVEN ───────────────────────────────────
  //
  // Schema shape:
  // {
  //   name        : string          — ComponentSet name in Figma
  //   layout      : "horizontal" | "vertical"
  //   label       : string | false  — text node content (false = no text)
  //   variantAxis : string          — axis key whose values drive fill/stroke/text
  //   sizeAxis    : string          — axis key whose values drive layout dims
  //   stateAxis   : string          — axis key whose values drive state overrides
  //   axes        : { [key]: string[] }
  //   sizes       : { [sizeValue]: SizeConfig }
  //   defaultSize : SizeConfig      — used when no sizeAxis
  //   styles      : nested by variantAxis -> stateAxis -> StyleConfig
  //                 (collapses when either axis is absent)
  // }
  //
  // SizeConfig  : { paddingH, paddingV, gap, height, width, textStyle, radius, radiusFallback }
  // StyleConfig : { bg, bgHex, text, textHex, border, borderHex, borderWidth, focus, opacity }

  if (msg.type === 'run-component') {
    try {
      var schema = msg.schema;
      if (!schema || !schema.name) throw new Error('Missing "name" in schema');

      // ── ICON SET ──────────────────────────────────────────────────────────
      if (schema.type === 'icon-set') {
        var icons    = schema.icons || [];
        var iconSize = 16;
        var iconColor = '#111422'; // neutral-900

        // Apply consistent stroke / fill styling to every child node
        function styleIconNode(node) {
          var c = hexToRgba(iconColor);
          var paint = { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: 1 };
          if ('children' in node) {
            for (var k = 0; k < node.children.length; k++) { styleIconNode(node.children[k]); }
          } else {
            // Filled shapes (circles for "more" icons) keep fill; others get stroke only
            if (node.fills && node.fills.length > 0) {
              node.fills = [paint];
              node.strokes = [];
            } else {
              node.fills = [];
              node.strokes = [paint];
              node.strokeWeight = 1.5;
              try { node.strokeCap  = 'ROUND'; } catch (e) {}
              try { node.strokeJoin = 'ROUND'; } catch (e) {}
            }
          }
        }

        var comps = [];
        for (var ii = 0; ii < icons.length; ii++) {
          var icon     = icons[ii];
          var inner    = icon.d ? '<path d="' + icon.d + '"/>' : (icon.svg || '');
          var svgStr   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + iconSize + '" height="' + iconSize + '" fill="none" stroke="' + iconColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';

          var comp = figma.createComponent();
          comp.name   = 'Name=' + icon.name;
          comp.resize(iconSize, iconSize);
          comp.fills  = [];
          comp.clipsContent = true;

          var svgFrame = figma.createNodeFromSvg(svgStr);
          svgFrame.resize(iconSize, iconSize);

          // Move vector children from SVG frame into the component, then style them
          var svgChildren = svgFrame.children.slice();
          for (var sc = 0; sc < svgChildren.length; sc++) {
            comp.appendChild(svgChildren[sc]);
          }
          svgFrame.remove();
          styleIconNode(comp);

          comps.push(comp);
        }

        // Grid layout: 10 columns
        var cols = 10, gx = 12, gy = 12;
        for (var i = 0; i < comps.length; i++) {
          comps[i].x = (i % cols) * (iconSize + gx);
          comps[i].y = Math.floor(i / cols) * (iconSize + gy);
        }

        var set = figma.combineAsVariants(comps, figma.currentPage);
        set.name = 'Icon';
        set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 32;

        // Wrap in a Figma section
        var section = figma.createSection();
        section.name = 'Icon';
        section.appendChild(set);

        figma.viewport.scrollAndZoomIntoView([section]);
        figma.ui.postMessage({ type: 'done-comp', text: 'Icon — ' + comps.length + ' icons created.' });
        return;
      }

      if (!schema.axes) throw new Error('Missing "axes" in schema');

      // Index local variables and text styles by name
      var allVars = figma.variables.getLocalVariables();
      var varMap  = {};
      for (var i = 0; i < allVars.length; i++) { varMap[allVars[i].name] = allVars[i]; }

      var allTs = figma.getLocalTextStyles();
      var tsMap = {};
      for (var i = 0; i < allTs.length; i++) { tsMap[allTs[i].name] = allTs[i]; }

      // Collect unique fonts from sizes + fallback
      var fontsNeeded = { 'Inter|Semi Bold': { family: 'Inter', style: 'Semi Bold' } };
      var szSrc = schema.sizes ? Object.values(schema.sizes) : [];
      if (schema.defaultSize) szSrc.push(schema.defaultSize);
      for (var i = 0; i < szSrc.length; i++) {
        var tsName = szSrc[i].textStyle;
        if (tsName && tsMap[tsName]) {
          var fn = tsMap[tsName].fontName;
          fontsNeeded[fn.family + '|' + fn.style] = fn;
        }
      }

      logComp('Loading fonts...', 'info');
      var fKeys = Object.keys(fontsNeeded);
      for (var i = 0; i < fKeys.length; i++) {
        var fn = fontsNeeded[fKeys[i]];
        try   { await figma.loadFontAsync(fn); }
        catch (e) { logComp('Font not found: ' + fn.family + ' ' + fn.style, 'warn'); }
      }
      logComp('Fonts ready', 'ok');

      // ── HELPERS ──────────────────────────────────────────────────────────

      function makeFill(fallbackHex, varName) {
        var c = hexToRgba(fallbackHex || '#888888');
        var p = { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
        if (varName && varMap[varName]) {
          p = figma.variables.setBoundVariableForPaint(p, 'color', varMap[varName]);
        }
        return p;
      }

      // Cartesian product: axes object -> array of combo objects
      function cartesian(axes) {
        var keys = Object.keys(axes);
        var acc  = [{}];
        for (var i = 0; i < keys.length; i++) {
          var key  = keys[i];
          var vals = axes[key];
          var next = [];
          for (var j = 0; j < acc.length; j++) {
            for (var k = 0; k < vals.length; k++) {
              var prev  = acc[j];
              var combo = {};
              var pk    = Object.keys(prev);
              for (var m = 0; m < pk.length; m++) { combo[pk[m]] = prev[pk[m]]; }
              combo[key] = vals[k];
              next.push(combo);
            }
          }
          acc = next;
        }
        return acc;
      }

      // "Variant=Primary, Size=MD, State=Default"
      function buildName(combo) {
        return Object.keys(combo).map(function(k) { return k + '=' + combo[k]; }).join(', ');
      }

      // Resolve appearance config for this combo
      function getStyle(combo) {
        var styles = schema.styles;
        if (!styles) return {};
        var va = schema.variantAxis;
        var sa = schema.stateAxis;
        if (va && sa) {
          var bucket = styles[combo[va]];
          return (bucket && bucket[combo[sa]]) ? bucket[combo[sa]] : {};
        }
        if (va) { return styles[combo[va]] || {}; }
        if (sa) { return styles[combo[sa]] || {}; }
        return (typeof styles === 'object' && !Array.isArray(styles)) ? styles : {};
      }

      // Resolve layout config for this combo
      function getSize(combo) {
        var sa = schema.sizeAxis;
        if (sa && schema.sizes && combo[sa]) { return schema.sizes[combo[sa]] || {}; }
        return schema.defaultSize || {};
      }

      // ── CREATE COMPONENTS ─────────────────────────────────────────────────

      // Recursively recolor stroke/fill nodes inside an icon instance
      function recolorIconNode(node, textHex) {
        var c = hexToRgba(textHex || '#ffffff');
        var paint = { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: 1 };
        if ('children' in node) {
          for (var k = 0; k < node.children.length; k++) {
            recolorIconNode(node.children[k], textHex);
          }
        } else {
          if (node.strokes && node.strokes.length > 0) { node.strokes = [paint]; }
          if (node.fills  && node.fills.length  > 0) { node.fills   = [paint]; }
        }
      }

      // Cache the Icon component set lookup so we only search once per generate run
      var _iconSet;
      function getIconSet() {
        if (_iconSet === undefined) {
          // Search all pages so the Icon set is found regardless of which page it was generated on
          _iconSet = figma.root.findOne(function(n) {
            return n.type === 'COMPONENT_SET' && n.name === 'Icon';
          }) || null;
        }
        return _iconSet;
      }

      // Make an icon slot — nested Icon instance coloured to match button text,
      // falls back to a tinted rectangle if the Icon set doesn't exist yet
      function makeIconSlot(size, textHex, iconName) {
        var iconSet = getIconSet();
        if (iconSet) {
          // Prefer the named icon, fall back to first child
          var iconComp = iconSet.findOne(function(n) {
            return n.type === 'COMPONENT' && n.name === 'Name=' + (iconName || '');
          }) || iconSet.children[0];

          if (iconComp) {
            var inst = iconComp.createInstance();
            inst.resize(size, size);
            recolorIconNode(inst, textHex);
            return inst;
          }
        }
        // Fallback: tinted rectangle
        var slot = figma.createRectangle();
        slot.name = 'Icon';
        slot.resize(size, size);
        slot.cornerRadius = 3;
        var c = hexToRgba(textHex || '#ffffff');
        slot.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: 0.25 }];
        return slot;
      }

      // Make a spinner arc — SVG path so Figma treats it as a true vector (not rasterized)
      // 270° open arc drawn as a path, stroke-only, round caps
      function makeSpinner(size, textHex) {
        var hex = textHex || '#ffffff';
        // SVG: circle arc from top (12 o'clock) sweeping 270° clockwise, leaving a 90° gap at bottom-right
        // For a 24×24 viewBox: radius=10, center=12,12
        // Start: 12,2 (top)  End: 22,12 (right)  large-arc-flag=1
        var svgStr =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
          '<path d="M 12 2 A 10 10 0 1 1 22 12" fill="none" stroke="' + hex + '" stroke-width="2" stroke-linecap="round"/>' +
          '</svg>';
        var sp = figma.createNodeFromSvg(svgStr);
        sp.name = 'Spinner';
        sp.resize(size, size);
        return sp;
      }

      // ── INPUT — vertical auto-layout: label + field frame + helper text ──────
      if (schema.type === 'input') {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

        var inputCombos = cartesian(schema.axes);
        var inputComps  = [];
        var FIELD_W     = 240;
        var ICON_SZ     = 16;

        // Cache the default icon component for INSTANCE_SWAP property
        var _defIconSet  = getIconSet();
        var _defIconComp = _defIconSet
          ? (_defIconSet.findOne(function(n) { return n.type === 'COMPONENT' && n.name === 'Name=search'; })
             || (_defIconSet.children.length ? _defIconSet.children[0] : null))
          : null;

        for (var ci2 = 0; ci2 < inputCombos.length; ci2++) {
          var combo2  = inputCombos[ci2];
          var sz2     = getSize(combo2);
          var cfg2    = getStyle(combo2);

          var stateVal2  = combo2[schema.variantAxis] || 'Default';
          var iconVal2   = combo2.Icon    || 'None';
          var helperVal2 = combo2.Helper  || 'None';
          var reqVal2    = combo2.Required || 'False';

          var isLoading2  = stateVal2 === 'Loading';
          var isError2    = stateVal2 === 'Error';
          var isSuccess2  = stateVal2 === 'Success';
          var isDisabled2 = stateVal2 === 'Disabled';

          // ── OUTER COMPONENT (vertical wrapper) ────────────────────────────
          var comp2 = figma.createComponent();
          comp2.name = buildName(combo2);
          comp2.layoutMode            = 'VERTICAL';
          comp2.primaryAxisAlignItems = 'MIN';
          comp2.counterAxisAlignItems = 'MIN';
          comp2.itemSpacing           = 4;
          comp2.paddingLeft = comp2.paddingRight = comp2.paddingTop = comp2.paddingBottom = 0;
          comp2.primaryAxisSizingMode = 'AUTO';
          comp2.counterAxisSizingMode = 'FIXED';
          comp2.fills   = [];
          comp2.strokes = [];
          comp2.resize(FIELD_W, comp2.height || 40);

          // ── LABEL ─────────────────────────────────────────────────────────
          var labelChars = reqVal2 === 'True' ? 'Label *' : 'Label';
          var labelTsObj = schema.labelStyle && tsMap[schema.labelStyle] ? tsMap[schema.labelStyle] : null;
          var labelNode  = figma.createText();
          if (labelTsObj) {
            labelNode.textStyleId = labelTsObj.id;
          } else {
            labelNode.fontName   = { family: 'Inter', style: 'Medium' };
            labelNode.fontSize   = 12;
            labelNode.lineHeight = { unit: 'PERCENT', value: 150 };
          }
          labelNode.characters = labelChars;
          labelNode.fills = [makeFill(isDisabled2 ? '#9198b4' : '#111422',
                                      isDisabled2 ? 'color/text/disabled' : 'color/text/primary')];
          comp2.appendChild(labelNode);

          // ── FIELD FRAME ───────────────────────────────────────────────────
          var hasLeading2  = iconVal2 === 'Leading';
          var hasTrailing2 = isLoading2 || isError2 || isSuccess2;

          var fieldFrame2 = figma.createFrame();
          fieldFrame2.name = 'Field';
          fieldFrame2.layoutMode            = 'HORIZONTAL';
          fieldFrame2.primaryAxisAlignItems = 'CENTER';
          fieldFrame2.counterAxisAlignItems = 'CENTER';
          fieldFrame2.primaryAxisSizingMode = 'FIXED';
          fieldFrame2.counterAxisSizingMode = 'FIXED';

          var fieldH2 = sz2.height || 40;
          fieldFrame2.resize(FIELD_W, fieldH2);

          // Border radius
          if (sz2.radius && varMap[sz2.radius]) {
            try {
              fieldFrame2.setBoundVariable('topLeftRadius',     varMap[sz2.radius]);
              fieldFrame2.setBoundVariable('topRightRadius',    varMap[sz2.radius]);
              fieldFrame2.setBoundVariable('bottomLeftRadius',  varMap[sz2.radius]);
              fieldFrame2.setBoundVariable('bottomRightRadius', varMap[sz2.radius]);
            } catch (e) { fieldFrame2.cornerRadius = sz2.radiusFallback || 0; }
          } else if (sz2.radiusFallback !== undefined) {
            fieldFrame2.cornerRadius = sz2.radiusFallback;
          }

          // Padding
          fieldFrame2.paddingLeft   = hasLeading2 ? 8 : (sz2.paddingH || 12);
          fieldFrame2.paddingRight  = hasTrailing2 ? 8 : (sz2.paddingH || 12);
          fieldFrame2.paddingTop    = 0;
          fieldFrame2.paddingBottom = 0;
          fieldFrame2.itemSpacing   = hasLeading2 ? 8 : 0;

          // Background & stroke
          fieldFrame2.fills = (cfg2.bg || cfg2.bgHex)
            ? [makeFill(cfg2.bgHex || '#ffffff', cfg2.bg)]
            : [];
          if (cfg2.border || cfg2.borderHex) {
            fieldFrame2.strokes     = [makeFill(cfg2.borderHex || '#e2e5ef', cfg2.border)];
            fieldFrame2.strokeWeight = cfg2.borderWidth || 1;
            fieldFrame2.strokeAlign  = 'INSIDE';
          } else {
            fieldFrame2.strokes = [];
          }

          // Focus ring
          fieldFrame2.effects = cfg2.focus ? [{
            type: 'DROP_SHADOW', blendMode: 'NORMAL', visible: true,
            color: { r: 0, g: 0.408, b: 1, a: 0.35 },
            offset: { x: 0, y: 0 }, radius: 0, spread: 3
          }] : [];

          // Leading icon slot — keep reference for property binding after append
          var iconInst2 = null;
          if (hasLeading2) {
            iconInst2 = makeIconSlot(ICON_SZ, cfg2.textHex || '#9198b4', 'search');
            fieldFrame2.appendChild(iconInst2);
          }

          // Placeholder text (grows to fill remaining width)
          var placeTsObj = schema.placeholderStyle && tsMap[schema.placeholderStyle] ? tsMap[schema.placeholderStyle] : null;
          var placeNode  = figma.createText();
          if (placeTsObj) {
            placeNode.textStyleId = placeTsObj.id;
          } else {
            placeNode.fontName   = { family: 'Inter', style: 'Regular' };
            placeNode.fontSize   = 12;
            placeNode.lineHeight = { unit: 'PERCENT', value: 150 };
          }
          placeNode.characters = 'Placeholder';
          placeNode.fills      = [makeFill(cfg2.textHex || '#9198b4', cfg2.text)];
          placeNode.layoutGrow = 1;
          fieldFrame2.appendChild(placeNode);

          // Trailing slot (spinner / check / error icon)
          if (isLoading2) {
            fieldFrame2.appendChild(makeSpinner(ICON_SZ, cfg2.textHex || '#9198b4'));
          } else if (isSuccess2) {
            fieldFrame2.appendChild(makeIconSlot(ICON_SZ, '#0caf60', 'check-circle'));
          } else if (isError2) {
            fieldFrame2.appendChild(makeIconSlot(ICON_SZ, '#f03030', 'error'));
          }

          // fieldFrame2 must be inside comp2 before binding component properties
          comp2.appendChild(fieldFrame2);

          // TEXT properties — bound after nodes are inside the component tree
          try {
            var labelKey = comp2.addComponentProperty('Label', 'TEXT', labelChars);
            labelNode.componentPropertyReferences = { characters: labelKey };
          } catch (e) {}
          try {
            var placeholderKey = comp2.addComponentProperty('Placeholder', 'TEXT', 'Placeholder');
            placeNode.componentPropertyReferences = { characters: placeholderKey };
          } catch (e) {}

          // INSTANCE_SWAP property — bound after iconInst2 is inside the component tree
          if (iconInst2 && iconInst2.type === 'INSTANCE' && _defIconComp) {
            try {
              var iconSwapKey = comp2.addComponentProperty('Icon', 'INSTANCE_SWAP', _defIconComp.id);
              iconInst2.componentPropertyReferences = { mainComponent: iconSwapKey };
            } catch (e) {}
          }

          // ── HELPER TEXT ───────────────────────────────────────────────────
          if (helperVal2 === 'On') {
            var helperChars, helperHex2, helperToken;
            if (isError2) {
              helperChars  = 'Error message';
              helperHex2   = '#9e1111';
              helperToken  = 'color/error/text';
            } else if (isSuccess2) {
              helperChars  = 'Success message';
              helperHex2   = '#06703d';
              helperToken  = 'color/success/text';
            } else {
              helperChars  = 'Helper text';
              helperHex2   = '#464d6b';
              helperToken  = 'color/text/secondary';
            }
            var helperTsObj = schema.helperStyle && tsMap[schema.helperStyle] ? tsMap[schema.helperStyle] : null;
            var helperNode  = figma.createText();
            if (helperTsObj) {
              helperNode.textStyleId = helperTsObj.id;
            } else {
              helperNode.fontName   = { family: 'Inter', style: 'Regular' };
              helperNode.fontSize   = 12;
              helperNode.lineHeight = { unit: 'PERCENT', value: 150 };
            }
            helperNode.characters = helperChars;
            helperNode.fills      = [makeFill(helperHex2, helperToken)];
            comp2.appendChild(helperNode);
          }

          inputComps.push(comp2);
        }

        logComp(inputComps.length + ' input variants built. Combining...', 'info');

        // Grid: Size is the last axis — cols = number of sizes
        var inputLastAxis = schema.axes[Object.keys(schema.axes).pop()];
        var inputCols = inputLastAxis.length;  // 3 (SM/MD/LG)
        var igapX = 16, igapY = 24, ix = 0, iy = 0, iRowH = 0;
        for (var ii2 = 0; ii2 < inputComps.length; ii2++) {
          inputComps[ii2].x = ix;
          inputComps[ii2].y = iy;
          if (inputComps[ii2].height > iRowH) iRowH = inputComps[ii2].height;
          if ((ii2 + 1) % inputCols === 0) { ix = 0; iy += iRowH + igapY; iRowH = 0; }
          else                              { ix += inputComps[ii2].width + igapX; }
        }

        var inputSet = figma.combineAsVariants(inputComps, figma.currentPage);
        inputSet.name = schema.name;
        inputSet.paddingLeft = inputSet.paddingRight = inputSet.paddingTop = inputSet.paddingBottom = 40;

        figma.viewport.scrollAndZoomIntoView([inputSet]);
        figma.ui.postMessage({ type: 'done-comp', text: schema.name + ' — ' + inputComps.length + ' variants created.' });
        return;
      }

      // ── SELECT ───────────────────────────────────────────────────────────────
      if (schema.type === 'select') {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

        var selCombos = cartesian(schema.axes);
        var selComps  = [];
        var SEL_W     = 240;
        var SEL_ICO   = 16;

        var _selIconSet  = getIconSet();
        var _selDefComp  = _selIconSet
          ? (_selIconSet.findOne(function(n) { return n.type === 'COMPONENT' && n.name === 'Name=grid'; })
             || (_selIconSet.findOne(function(n) { return n.type === 'COMPONENT'; }))
             || null)
          : null;

        for (var sc = 0; sc < selCombos.length; sc++) {
          var sCombo = selCombos[sc];
          var sSz    = getSize(sCombo);
          var sCfg   = getStyle(sCombo);

          var sState      = sCombo[schema.variantAxis] || 'Default';
          var sValue      = sCombo.Value  || 'Empty';
          var sIconVal    = sCombo.Icon   || 'None';

          var sIsLoading  = sState === 'Loading';
          var sIsError    = sState === 'Error';
          var sIsSuccess  = sState === 'Success';
          var sIsDisabled = sState === 'Disabled';
          var sIsFilled   = sValue === 'Filled';
          var sHasLeading = sIconVal === 'Leading';

          // Text: tertiary for placeholder (Empty), primary for filled, disabled when Disabled
          var sTextHex   = sIsDisabled ? '#9198b4' : (sIsFilled ? '#111422' : '#9198b4');
          var sTextToken = sIsDisabled ? 'color/text/disabled' : (sIsFilled ? 'color/text/primary' : 'color/text/tertiary');

          // ── OUTER COMPONENT ─────────────────────────────────────────────────
          var sComp = figma.createComponent();
          sComp.name = buildName(sCombo);
          sComp.layoutMode            = 'VERTICAL';
          sComp.primaryAxisAlignItems = 'MIN';
          sComp.counterAxisAlignItems = 'MIN';
          sComp.itemSpacing           = 4;
          sComp.paddingLeft = sComp.paddingRight = sComp.paddingTop = sComp.paddingBottom = 0;
          sComp.primaryAxisSizingMode = 'AUTO';
          sComp.counterAxisSizingMode = 'FIXED';
          sComp.fills   = [];
          sComp.strokes = [];
          sComp.resize(SEL_W, sComp.height || 40);

          // ── LABEL ──────────────────────────────────────────────────────────
          var sLabelTsObj = schema.labelStyle && tsMap[schema.labelStyle] ? tsMap[schema.labelStyle] : null;
          var sLabelNode  = figma.createText();
          if (sLabelTsObj) {
            sLabelNode.textStyleId = sLabelTsObj.id;
          } else {
            sLabelNode.fontName   = { family: 'Inter', style: 'Medium' };
            sLabelNode.fontSize   = 12;
            sLabelNode.lineHeight = { unit: 'PERCENT', value: 150 };
          }
          sLabelNode.characters = schema.label || 'Label';
          sLabelNode.fills = [makeFill(sIsDisabled ? '#9198b4' : '#111422',
                                       sIsDisabled ? 'color/text/disabled' : 'color/text/primary')];
          sComp.appendChild(sLabelNode);

          // ── FIELD FRAME ────────────────────────────────────────────────────
          var sField = figma.createFrame();
          sField.name = 'Field';
          sField.layoutMode            = 'HORIZONTAL';
          sField.primaryAxisAlignItems = 'CENTER';
          sField.counterAxisAlignItems = 'CENTER';
          sField.primaryAxisSizingMode = 'FIXED';
          sField.counterAxisSizingMode = 'FIXED';
          sField.resize(SEL_W, sSz.height || 40);

          // Border radius
          if (sSz.radius && varMap[sSz.radius]) {
            try {
              sField.setBoundVariable('topLeftRadius',     varMap[sSz.radius]);
              sField.setBoundVariable('topRightRadius',    varMap[sSz.radius]);
              sField.setBoundVariable('bottomLeftRadius',  varMap[sSz.radius]);
              sField.setBoundVariable('bottomRightRadius', varMap[sSz.radius]);
            } catch(e) { sField.cornerRadius = sSz.radiusFallback || 0; }
          } else if (sSz.radiusFallback !== undefined) {
            sField.cornerRadius = sSz.radiusFallback;
          }

          // Padding
          var sPadH = sSz.paddingH || 12;
          sField.paddingLeft   = sHasLeading ? 8 : sPadH;
          sField.paddingRight  = 8;
          sField.paddingTop    = 0;
          sField.paddingBottom = 0;
          sField.itemSpacing   = sHasLeading ? 8 : 4;

          // Background & stroke
          sField.fills = (sCfg.bg || sCfg.bgHex)
            ? [makeFill(sCfg.bgHex || '#ffffff', sCfg.bg)]
            : [];
          if (sCfg.border || sCfg.borderHex) {
            sField.strokes      = [makeFill(sCfg.borderHex || '#e2e5ef', sCfg.border)];
            sField.strokeWeight  = 1;
            sField.strokeAlign   = 'INSIDE';
          } else {
            sField.strokes = [];
          }

          // Focus ring
          sField.effects = sCfg.focus ? [{
            type: 'DROP_SHADOW', blendMode: 'NORMAL', visible: true,
            color: { r: 0, g: 0.408, b: 1, a: 0.35 },
            offset: { x: 0, y: 0 }, radius: 0, spread: 3
          }] : [];

          // Leading icon — 'grid' (four squares), nothing like a caret
          var sIconInst = null;
          if (sHasLeading) {
            sIconInst = makeIconSlot(SEL_ICO, sTextHex, 'grid');
            sField.appendChild(sIconInst);
          }

          // Value / placeholder text — uses placeholderStyle (Body/Small, Regular)
          var sValTsObj = schema.placeholderStyle && tsMap[schema.placeholderStyle]
            ? tsMap[schema.placeholderStyle]
            : null;
          var sValNode  = figma.createText();
          if (sValTsObj) {
            sValNode.textStyleId = sValTsObj.id;
          } else {
            sValNode.fontName   = { family: 'Inter', style: 'Regular' };
            sValNode.fontSize   = 12;
            sValNode.lineHeight = { unit: 'PERCENT', value: 150 };
          }
          sValNode.characters = sIsFilled ? 'Current account — ••4582' : 'Choose an option';
          sValNode.fills      = [makeFill(sTextHex, sTextToken)];
          sValNode.layoutGrow = 1;
          sField.appendChild(sValNode);

          // Trailing slot: status icons or chevron
          if (sIsLoading) {
            sField.appendChild(makeSpinner(SEL_ICO, sIsDisabled ? '#9198b4' : '#636a88'));
          } else if (sIsSuccess) {
            sField.appendChild(makeIconSlot(SEL_ICO, '#0caf60', 'check-circle'));
          } else if (sIsError) {
            sField.appendChild(makeIconSlot(SEL_ICO, '#f03030', 'error'));
          } else {
            sField.appendChild(makeIconSlot(SEL_ICO, sIsDisabled ? '#9198b4' : '#636a88', 'chevron-down'));
          }

          sComp.appendChild(sField);
          sField.layoutSizingHorizontal = 'FILL';

          // ── DROPDOWN PANEL (hidden by default, toggled via BOOLEAN property) ──
          var sDrop = figma.createFrame();
          sDrop.name = 'Dropdown';
          sDrop.layoutMode            = 'VERTICAL';
          sDrop.primaryAxisSizingMode = 'AUTO';
          sDrop.counterAxisSizingMode = 'FIXED';
          sDrop.resize(SEL_W, 40);
          sDrop.paddingLeft = sDrop.paddingRight = 4;
          sDrop.paddingTop  = sDrop.paddingBottom = 4;
          sDrop.itemSpacing = 2;
          sDrop.cornerRadius = 8;
          sDrop.fills   = [makeFill('#ffffff', 'color/bg/surface')];
          sDrop.strokes = [makeFill('#e2e5ef', 'color/border/default')];
          sDrop.strokeWeight = 1;
          sDrop.strokeAlign  = 'INSIDE';
          sDrop.effects = [
            { type: 'DROP_SHADOW', blendMode: 'NORMAL', visible: true,
              color: { r: 0, g: 0, b: 0, a: 0.08 },
              offset: { x: 0, y: 4 }, radius: 8,  spread: 0 },
            { type: 'DROP_SHADOW', blendMode: 'NORMAL', visible: true,
              color: { r: 0, g: 0, b: 0, a: 0.10 },
              offset: { x: 0, y: 10 }, radius: 24, spread: -4 }
          ];

          var sOptLabels = [
            'Current account — ••4582',
            'Savings account  — ••1293',
            'Cash ISA — ••8801',
            'Business account — ••3370'
          ];
          var sSelIdx = sIsFilled ? 0 : -1;
          var sHovIdx = sIsFilled ? 1 : 0;

          for (var oi = 0; oi < sOptLabels.length; oi++) {
            var sOptRow = figma.createFrame();
            sOptRow.name = 'Option';
            sOptRow.layoutMode            = 'HORIZONTAL';
            sOptRow.primaryAxisAlignItems = 'MIN';
            sOptRow.counterAxisAlignItems = 'CENTER';
            sOptRow.primaryAxisSizingMode = 'AUTO';
            sOptRow.counterAxisSizingMode = 'AUTO';
            sOptRow.paddingLeft = sOptRow.paddingRight = 12;
            sOptRow.paddingTop  = sOptRow.paddingBottom = 6;
            sOptRow.itemSpacing = 8;
            sOptRow.cornerRadius = 6;
            sOptRow.strokes = [];
            if (oi === sSelIdx) {
              sOptRow.fills = [makeFill('#eff5ff', 'color/brand/subtle')];
            } else if (oi === sHovIdx) {
              sOptRow.fills = [makeFill('#f0f2f7', 'color/bg/subtle')];
            } else {
              sOptRow.fills = [];
            }

            var sOptText = figma.createText();
            sOptText.fontName   = { family: 'Inter', style: oi === sSelIdx ? 'Medium' : 'Regular' };
            sOptText.fontSize   = 12;
            sOptText.lineHeight = { unit: 'PERCENT', value: 150 };
            sOptText.characters = sOptLabels[oi];
            sOptText.fills = [makeFill(
              oi === sSelIdx ? '#0040a0' : '#111422',
              oi === sSelIdx ? 'color/brand/text' : 'color/text/primary'
            )];
            sOptRow.appendChild(sOptText);

            if (oi === sSelIdx) {
              sOptRow.appendChild(makeIconSlot(14, '#0040a0', 'check'));
            }

            // Append to dropdown FIRST, then set FILL so Figma respects the parent context
            sDrop.appendChild(sOptRow);
            sOptRow.layoutSizingHorizontal = 'FILL';
            sOptRow.layoutSizingVertical   = 'HUG';
          }

          sDrop.visible = false;
          sComp.appendChild(sDrop);
          sDrop.layoutSizingVertical   = 'HUG';
          sDrop.layoutSizingHorizontal = 'FILL';

          // Component properties (append after all children are in the tree)
          try {
            var sLabelKey = sComp.addComponentProperty('Label', 'TEXT', schema.label || 'Label');
            sLabelNode.componentPropertyReferences = { characters: sLabelKey };
          } catch(e) {}
          try {
            var sValKey = sComp.addComponentProperty('Value', 'TEXT', sValNode.characters);
            sValNode.componentPropertyReferences = { characters: sValKey };
          } catch(e) {}
          if (sIconInst && sIconInst.type === 'INSTANCE' && _selDefComp) {
            try {
              var sIconKey = sComp.addComponentProperty('Icon', 'INSTANCE_SWAP', _selDefComp.id);
              sIconInst.componentPropertyReferences = { mainComponent: sIconKey };
            } catch(e) {}
          }
          try {
            var sExpandKey = sComp.addComponentProperty('Expanded', 'BOOLEAN', false);
            sDrop.componentPropertyReferences = { visible: sExpandKey };
          } catch(e) {}

          selComps.push(sComp);
        }

        logComp(selComps.length + ' select variants built. Combining...', 'info');

        // Grid: last axis (Size) = 3 cols
        var selLastAxis = schema.axes[Object.keys(schema.axes).pop()];
        var selCols2    = selLastAxis.length;
        var sgX = 16, sgY = 24, sx = 0, sy = 0, sRowH = 0;
        for (var si = 0; si < selComps.length; si++) {
          selComps[si].x = sx;
          selComps[si].y = sy;
          if (selComps[si].height > sRowH) sRowH = selComps[si].height;
          if ((si + 1) % selCols2 === 0) { sx = 0; sy += sRowH + sgY; sRowH = 0; }
          else                            { sx += selComps[si].width + sgX; }
        }

        var selectSet = figma.combineAsVariants(selComps, figma.currentPage);
        selectSet.name = schema.name;
        selectSet.paddingLeft = selectSet.paddingRight = selectSet.paddingTop = selectSet.paddingBottom = 40;

        figma.viewport.scrollAndZoomIntoView([selectSet]);
        figma.ui.postMessage({ type: 'done-comp', text: schema.name + ' — ' + selComps.length + ' variants created.' });
        return;
      }

      var combos     = cartesian(schema.axes);
      var components = [];

      for (var ci = 0; ci < combos.length; ci++) {
        var combo = combos[ci];
        var sz    = getSize(combo);
        var cfg   = getStyle(combo);

        // Derive icon and loading from combo
        var iconAxisKey = schema.iconAxis || null;
        var iconVal     = iconAxisKey ? (combo[iconAxisKey] || 'None') : 'None';
        var stateVal    = schema.stateAxis ? combo[schema.stateAxis] : null;
        var isLoading   = stateVal === 'Loading';
        var iconSize    = sz.iconSize || 16;

        var comp  = figma.createComponent();
        comp.name = buildName(combo);

        // Auto-layout
        comp.layoutMode            = schema.layout === 'vertical' ? 'VERTICAL' : 'HORIZONTAL';
        comp.primaryAxisAlignItems = 'CENTER';
        comp.counterAxisAlignItems = 'CENTER';
        comp.paddingTop            = sz.paddingV || 0;
        comp.paddingBottom         = sz.paddingV || 0;
        comp.itemSpacing           = isLoading ? 0 : (sz.gap || 0);

        // Padding — narrow on icon side; loading keeps natural label padding
        if (isLoading) {
          comp.paddingLeft  = sz.paddingH || 0;
          comp.paddingRight = sz.paddingH || 0;
        } else if (iconVal === 'Leading') {
          comp.paddingLeft  = sz.iconPaddingH !== undefined ? sz.iconPaddingH : (sz.paddingH || 0);
          comp.paddingRight = sz.paddingH || 0;
        } else if (iconVal === 'Trailing') {
          comp.paddingLeft  = sz.paddingH || 0;
          comp.paddingRight = sz.iconPaddingH !== undefined ? sz.iconPaddingH : (sz.paddingH || 0);
        } else {
          comp.paddingLeft  = sz.paddingH || 0;
          comp.paddingRight = sz.paddingH || 0;
        }

        // Content — loading: ghost label (holds width) + spinner centered absolutely
        //           normal:  optional icon slot + label + optional icon slot
        if (isLoading) {
          // Ghost text: invisible, maintains the same width as the Default button
          var tsObjG = (sz.textStyle && tsMap[sz.textStyle]) ? tsMap[sz.textStyle] : null;
          var ghost  = figma.createText();
          if (tsObjG) { ghost.textStyleId = tsObjG.id; }
          else        { ghost.fontSize = 14; ghost.fontName = { family: 'Inter', style: 'Semi Bold' }; }
          ghost.characters = schema.label || schema.name;
          ghost.fills      = [];
          ghost.opacity    = 0;
          comp.appendChild(ghost);
          // Spinner: use the Icon library instance for consistency; falls back to SVG if not found
          comp.appendChild(makeIconSlot(iconSize, cfg.textHex, 'Spinner'));
        } else {
          if (iconVal === 'Leading') { comp.appendChild(makeIconSlot(iconSize, cfg.textHex, 'Plus')); }

          if (schema.label !== false) {
            var tsObj = (sz.textStyle && tsMap[sz.textStyle]) ? tsMap[sz.textStyle] : null;
            var txt   = figma.createText();
            if (tsObj) {
              txt.textStyleId = tsObj.id;
            } else {
              txt.fontSize = 14;
              txt.fontName = { family: 'Inter', style: 'Semi Bold' };
            }
            txt.characters = schema.label || schema.name;
            txt.fills      = [makeFill(cfg.textHex || '#c8cde0', cfg.text)];
            comp.appendChild(txt);
          }

          if (iconVal === 'Trailing') { comp.appendChild(makeIconSlot(iconSize, cfg.textHex, 'ArrowRight')); }
        }

        // Sizing: hug width (ghost text drives it for Loading), fixed height
        comp.primaryAxisSizingMode = 'AUTO';
        comp.counterAxisSizingMode = sz.height ? 'FIXED' : 'AUTO';
        comp.resize(comp.width || 80, sz.height || comp.height || 40);

        // Loading: center the spinner absolutely over the ghost label
        // Spinner is the last child appended (Icon instance or rectangle fallback, not the TEXT ghost)
        if (isLoading && comp.children.length > 0) {
          var sp = comp.children[comp.children.length - 1];
          if (sp.type !== 'TEXT') {
            sp.layoutPositioning = 'ABSOLUTE';
            sp.x = Math.round((comp.width  - iconSize) / 2);
            sp.y = Math.round((comp.height - iconSize) / 2);
          }
        }

        // Corner radius — bind variable or apply fallback
        if (sz.radius && varMap[sz.radius]) {
          try {
            comp.setBoundVariable('topLeftRadius',     varMap[sz.radius]);
            comp.setBoundVariable('topRightRadius',    varMap[sz.radius]);
            comp.setBoundVariable('bottomLeftRadius',  varMap[sz.radius]);
            comp.setBoundVariable('bottomRightRadius', varMap[sz.radius]);
          } catch (e) { comp.cornerRadius = sz.radiusFallback || 0; }
        } else if (sz.radiusFallback !== undefined) {
          comp.cornerRadius = sz.radiusFallback;
        }

        // Background fill
        comp.fills = (cfg.bg || cfg.bgHex)
          ? [makeFill(cfg.bgHex || '#888888', cfg.bg)]
          : [];

        // Stroke / border
        if (cfg.border || cfg.borderHex) {
          comp.strokes      = [makeFill(cfg.borderHex || '#888888', cfg.border)];
          comp.strokeWeight  = cfg.borderWidth || 1;
          comp.strokeAlign   = 'INSIDE';
        } else {
          comp.strokes = [];
        }

        // Focus ring (spread drop-shadow — standard Figma technique)
        comp.effects = cfg.focus ? [{
          type: 'DROP_SHADOW', blendMode: 'NORMAL', visible: true,
          color: { r: 0, g: 0.408, b: 1, a: 0.35 },
          offset: { x: 0, y: 0 }, radius: 0, spread: 3
        }] : [];

        // Custom opacity
        if (cfg.opacity !== undefined) { comp.opacity = cfg.opacity; }

        components.push(comp);
      }

      logComp(components.length + ' components built. Combining...', 'info');

      // Grid layout before combining: last axis = columns
      var lastAxisVals = schema.axes[Object.keys(schema.axes).pop()];
      var cols = lastAxisVals.length;
      var gapX = 16, gapY = 16, x = 0, y = 0;
      for (var i = 0; i < components.length; i++) {
        components[i].x = x;
        components[i].y = y;
        if ((i + 1) % cols === 0) { x = 0; y += components[i].height + gapY; }
        else                      { x += components[i].width + gapX; }
      }

      // Combine into ComponentSet
      var set = figma.combineAsVariants(components, figma.currentPage);
      set.name = schema.name;
      set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 40;

      figma.viewport.scrollAndZoomIntoView([set]);
      figma.ui.postMessage({ type: 'done-comp', text: schema.name + ' — ' + components.length + ' variants created.' });

    } catch (e) {
      figma.ui.postMessage({ type: 'error-comp', text: e.message });
    }
    return;
  }

  // ── EXPORT VARIABLES → tokens.json ───────────────────────────────────────
  if (msg.type === 'run-export-vars') {
    try {
      var collections = figma.variables.getLocalVariableCollections();
      var allVars     = figma.variables.getLocalVariables();

      // Index variables by id for alias resolution
      var varById = {};
      for (var i = 0; i < allVars.length; i++) { varById[allVars[i].id] = allVars[i]; }

      // Figma name "color/brand" → dot path "color.brand"
      function toDot(name) { return name.replace(/\//g, '.'); }

      // {r,g,b,a} → hex string
      function toHex(c) {
        var r = Math.round(c.r * 255);
        var g = Math.round(c.g * 255);
        var b = Math.round(c.b * 255);
        var h = function(n) { return n.toString(16).padStart(2, '0'); };
        return (c.a !== undefined && c.a < 0.9999)
          ? '#' + h(r) + h(g) + h(b) + h(Math.round(c.a * 255))
          : '#' + h(r) + h(g) + h(b);
      }

      // Infer Tokens Studio type from variable name + resolvedType
      function inferType(v) {
        if (v.resolvedType === 'COLOR')  return 'color';
        if (v.resolvedType === 'STRING') return 'fontFamilies';
        var n = v.name;
        if (n.indexOf('spacing')        === 0) return 'spacing';
        if (n.indexOf('borderRadius')   === 0) return 'borderRadius';
        if (n.indexOf('borderWidth')    === 0) return 'borderWidth';
        if (n.indexOf('fontSizes')      === 0) return 'fontSizes';
        if (n.indexOf('fontWeights')    === 0) return 'fontWeights';
        if (n.indexOf('lineHeights')    === 0) return 'lineHeights';
        if (n.indexOf('fontFamilies')   === 0) return 'fontFamilies';
        return 'other';
      }

      // Types that need a 'px' suffix on export
      var pxTypes = ['spacing', 'borderRadius', 'borderWidth', 'fontSizes'];

      // Resolve a raw mode value to a token value string
      function resolveValue(raw, resolvedType, tokenType) {
        if (resolvedType === 'COLOR') {
          if (raw && raw.type === 'VARIABLE_ALIAS') {
            var ref = varById[raw.id];
            return ref ? '{' + toDot(ref.name) + '}' : '#000000';
          }
          return toHex(raw);
        }
        if (resolvedType === 'FLOAT') {
          return (pxTypes.indexOf(tokenType) !== -1) ? raw + 'px' : raw;
        }
        return String(raw);
      }

      // Deep-set a value at dot-path parts inside obj
      function deepSet(obj, parts, leaf) {
        var cur = obj;
        for (var i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]]) cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = leaf;
      }

      var result = {
        '$metadata': { tokenSetOrder: ['primitives', 'semantic/light', 'semantic/dark'] }
      };

      for (var ci = 0; ci < collections.length; ci++) {
        var col = collections[ci];

        if (col.name === 'Primitives') {
          result['primitives'] = {};
          var modeId = col.modes[0].modeId;

          for (var vi = 0; vi < allVars.length; vi++) {
            var v = allVars[vi];
            if (v.variableCollectionId !== col.id) continue;
            var raw      = v.valuesByMode[modeId];
            if (raw === undefined || raw === null) continue;
            var tokType  = inferType(v);
            var tokValue = resolveValue(raw, v.resolvedType, tokType);
            if (tokValue === null) continue;
            deepSet(result['primitives'], toDot(v.name).split('.'), { value: tokValue, type: tokType });
          }
        }

        if (col.name === 'Semantic') {
          for (var mi = 0; mi < col.modes.length; mi++) {
            var mode   = col.modes[mi];
            var setKey = 'semantic/' + mode.name.toLowerCase();
            result[setKey] = {};

            for (var vi = 0; vi < allVars.length; vi++) {
              var v = allVars[vi];
              if (v.variableCollectionId !== col.id) continue;
              var raw      = v.valuesByMode[mode.modeId];
              if (raw === undefined || raw === null) continue;
              var tokType  = inferType(v);
              var tokValue = resolveValue(raw, v.resolvedType, tokType);
              if (tokValue === null) continue;
              deepSet(result[setKey], toDot(v.name).split('.'), { value: tokValue, type: tokType });
            }
          }
        }
      }

      var json = JSON.stringify(result, null, 2);
      var count = json.split('"value"').length - 1;
      figma.ui.postMessage({ type: 'export-vars-done', json: json, count: count });

    } catch (e) {
      figma.ui.postMessage({ type: 'export-vars-error', text: e.message });
    }
    return;
  }

  // ── EXPORT TEXT STYLES → text-styles.json ────────────────────────────────
  if (msg.type === 'run-export-ts') {
    try {
      var styles = figma.getLocalTextStyles();
      var result = [];

      for (var i = 0; i < styles.length; i++) {
        var s = styles[i];

        // lineHeight: PERCENT → multiplier, PIXELS → relative, AUTO → 1.5
        var lh = 1.5;
        if (s.lineHeight.unit === 'PERCENT') lh = Math.round((s.lineHeight.value / 100) * 1000) / 1000;
        if (s.lineHeight.unit === 'PIXELS')  lh = Math.round((s.lineHeight.value / s.fontSize) * 1000) / 1000;

        // letterSpacing: PERCENT → em, PIXELS → em relative
        var ls = 0;
        if (s.letterSpacing.unit === 'PERCENT') ls = Math.round((s.letterSpacing.value / 100) * 10000) / 10000;
        if (s.letterSpacing.unit === 'PIXELS')  ls = Math.round((s.letterSpacing.value / s.fontSize) * 10000) / 10000;

        result.push({
          name:          s.name,
          family:        s.fontName.family,
          weight:        s.fontName.style,
          size:          s.fontSize,
          lineHeight:    lh,
          letterSpacing: ls,
          description:   s.description || ''
        });
      }

      figma.ui.postMessage({ type: 'export-ts-done', json: JSON.stringify(result, null, 2), count: result.length });

    } catch (e) {
      figma.ui.postMessage({ type: 'export-ts-error', text: e.message });
    }
    return;
  }

  // ── LIST COMPONENT SETS ON CURRENT PAGE ───────────────────────────────────
  if (msg.type === 'run-get-components') {
    var sets = figma.currentPage.findAllWithCriteria({ types: ['COMPONENT_SET'] });
    var list = sets.map(function(s) { return { id: s.id, name: s.name }; });
    figma.ui.postMessage({ type: 'comp-list', list: list });
    return;
  }

  // ── EXPORT COMPONENT SCHEMA → components/<name>.json ──────────────────────
  if (msg.type === 'run-export-comp') {
    try {
      var set = figma.getNodeById(msg.id);
      if (!set || set.type !== 'COMPONENT_SET') {
        figma.ui.postMessage({ type: 'export-comp-error', text: 'Component set not found.' });
        return;
      }

      // Build varById map for variable resolution
      var allVars = figma.variables.getLocalVariables();
      var varById = {};
      for (var i = 0; i < allVars.length; i++) { varById[allVars[i].id] = allVars[i]; }

      // Read variant property definitions
      var defs  = set.componentPropertyDefinitions;
      var axes  = {};
      var variantAxis = null, sizeAxis = null, stateAxis = null;

      for (var key in defs) {
        if (defs[key].type !== 'VARIANT') continue;
        axes[key] = defs[key].variantOptions.slice();
        var lower = key.toLowerCase();
        if (lower === 'variant' || lower === 'type' || lower === 'kind') variantAxis = key;
        else if (lower === 'size')                                        sizeAxis    = key;
        else if (lower === 'state' || lower === 'status')                 stateAxis   = key;
      }

      // Sizes — read from children grouped by sizeAxis value (Default state only)
      var sizes = {};
      var styles = {};
      var children = set.children;

      for (var ci = 0; ci < children.length; ci++) {
        var child = children[ci];
        var vp    = child.variantProperties;

        var isDefault = !stateAxis || vp[stateAxis] === 'Default';

        // ── Sizes ──────────────────────────────────────────────────────────
        if (sizeAxis && vp[sizeAxis] && isDefault && !sizes[vp[sizeAxis]]) {
          var sKey = vp[sizeAxis];
          var sz   = { height: Math.round(child.height) };
          if (child.cornerRadius !== undefined && typeof child.cornerRadius === 'number')
            sz.radius = child.cornerRadius;
          if (child.paddingLeft  !== undefined) sz.paddingH = child.paddingLeft;
          if (child.paddingTop   !== undefined) sz.paddingV = child.paddingTop;
          if (child.itemSpacing  !== undefined) sz.gap      = child.itemSpacing;
          var textNode = child.findOne(function(n) { return n.type === 'TEXT'; });
          if (textNode) sz.fontSize = textNode.fontSize;
          sizes[sKey] = sz;
        }

        // ── Styles ─────────────────────────────────────────────────────────
        if (variantAxis && vp[variantAxis]) {
          var vKey = vp[variantAxis];
          var sKey2 = stateAxis ? vp[stateAxis] : 'Default';
          if (!styles[vKey])       styles[vKey] = {};
          if (!styles[vKey][sKey2]) {
            var entry = {};

            // Background fill
            if (child.fills && child.fills.length > 0) {
              var bgP = resolvePaint(child.fills[0], varById);
              if (bgP) { if (bgP.token) entry.bg = bgP.token; entry.bgHex = bgP.hex; }
            }

            // Stroke (border)
            if (child.strokes && child.strokes.length > 0) {
              var bP = resolvePaint(child.strokes[0], varById);
              if (bP) { if (bP.token) entry.border = bP.token; entry.borderHex = bP.hex; }
            }

            // Text color — from first TEXT child fill
            var tNode = child.findOne(function(n) { return n.type === 'TEXT'; });
            if (tNode && tNode.fills && tNode.fills.length > 0) {
              var tP = resolvePaint(tNode.fills[0], varById);
              if (tP) { if (tP.token) entry.text = tP.token; entry.textHex = tP.hex; }
            }

            // Focus ring flag
            if (stateAxis && sKey2 === 'Focus') entry.focus = true;

            styles[vKey][sKey2] = entry;
          }
        }
      }

      var schema = { name: set.name, layout: 'horizontal', label: set.name, axes: axes };
      if (variantAxis) schema.variantAxis = variantAxis;
      if (sizeAxis)    schema.sizeAxis    = sizeAxis;
      if (stateAxis)   schema.stateAxis   = stateAxis;
      if (Object.keys(sizes).length)  schema.sizes  = sizes;
      if (Object.keys(styles).length) schema.styles = styles;

      figma.ui.postMessage({
        type: 'export-comp-done',
        json: JSON.stringify(schema, null, 2),
        name: set.name.toLowerCase().replace(/\s+/g, '-')
      });

    } catch (e) {
      figma.ui.postMessage({ type: 'export-comp-error', text: e.message });
    }
    return;
  }

  // ── DOCUMENTATION TEMPLATE ────────────────────────────────────────────────
  if (msg.type === 'run-docs') {
    try {
      var schema = msg.schema;
      if (!schema || !schema.name) throw new Error('Missing "name" in schema');

      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
      logComp('Building docs template...', 'info');

      // Require an existing component set — instances only, no fallback frames
      var compSet = figma.currentPage.findOne(function(n) {
        return n.type === 'COMPONENT_SET' && n.name === schema.name;
      });
      if (!compSet) throw new Error(
        '"' + schema.name + '" component set not found on this page. ' +
        'Run "Generate" first, then come back to Generate Docs.'
      );
      logComp('Component set found — building with live instances', 'ok');

      // ── PALETTE ────────────────────────────────────────────────────────────
      var C = {
        surface:     '#ffffff', bg:      '#f8f9fc',
        border:      '#e2e5ef', text:    '#1e2235',
        secondary:   '#636a88', muted:   '#9198b4',
        blue:        '#0068ff', blueBg:  '#eff5ff', blueDark: '#0040a0',
        greenBg:     '#edfaf3', green:   '#06703d', greenBorder: '#68d4a0',
        redBg:       '#fff0f0', red:     '#9e1111', redBorder:   '#ff7b7b',
        codeBg:      '#111422', codeText:'#c8cde0', codeComment: '#636a88'
      };

      // ── LOW-LEVEL HELPERS ──────────────────────────────────────────────────

      // Safe fill/stroke paint — strips 'a' from color, moves it to opacity
      function fill(hex) {
        var c = hexToRgba(hex);
        return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: (c.a !== undefined ? c.a : 1) };
      }

      // Auto-layout frame
      function af(name, dir, gap, padH, padV) {
        var f = figma.createFrame();
        f.name = name;
        f.layoutMode = (dir === 'V') ? 'VERTICAL' : 'HORIZONTAL';
        f.primaryAxisAlignItems = 'MIN';
        f.counterAxisAlignItems = 'MIN';
        f.itemSpacing  = gap  || 0;
        f.paddingLeft  = f.paddingRight  = padH || 0;
        f.paddingTop   = f.paddingBottom = padV || 0;
        f.primaryAxisSizingMode = 'AUTO';
        f.counterAxisSizingMode = 'AUTO';
        f.fills   = [];
        f.strokes = [];
        return f;
      }

      // Text node
      function tx(chars, size, style, color) {
        var t = figma.createText();
        t.fontName   = { family: 'Inter', style: style || 'Regular' };
        t.fontSize   = size || 12;
        t.characters = chars;
        t.fills      = [fill(color || C.text)];
        return t;
      }

      // Pill badge
      function pill(chars, bg, fg, h, padH) {
        var f = af('Pill/' + chars, 'H', 0, padH || 10, 0);
        f.primaryAxisAlignItems = 'CENTER';
        f.counterAxisAlignItems = 'CENTER';
        f.counterAxisSizingMode = 'FIXED';
        f.resize(f.width || 60, h || 22);
        f.cornerRadius = 9999;
        f.fills = [fill(bg)];
        f.appendChild(tx(chars, 10, 'Semi Bold', fg));
        return f;
      }

      // Section label + divider
      function sectionLabel(label) {
        var f = af('SLabel/' + label, 'V', 8, 0, 0);
        var t = tx(label.toUpperCase(), 10, 'Bold', C.muted);
        t.letterSpacing = { unit: 'PERCENT', value: 8 };
        f.appendChild(t);
        var line = figma.createRectangle();
        line.name = 'Divider'; line.resize(632, 1);
        line.fills = [fill(C.border)];
        f.appendChild(line);
        return f;
      }

      function section(label) {
        var f = af('S/' + label, 'V', 20, 0, 0);
        f.appendChild(sectionLabel(label));
        return f;
      }

      // Find a specific component in the set by variant property values
      function findComp(variant, size, state) {
        return compSet.findOne(function(n) {
          if (n.type !== 'COMPONENT') return false;
          var p = n.variantProperties;
          if (schema.variantAxis && variant && p[schema.variantAxis] !== variant) return false;
          if (schema.sizeAxis    && size    && p[schema.sizeAxis]    !== size)    return false;
          if (schema.stateAxis   && state   && p[schema.stateAxis]   !== state)   return false;
          return true;
        });
      }

      // Create a live instance — throws if the specific variant is not found
      function inst(variant, size, state) {
        var comp = findComp(variant, size, state);
        if (!comp) throw new Error(
          'Component not found: ' + [variant, size, state].filter(Boolean).join(' / ')
        );
        return comp.createInstance();
      }

      // Column: preview node + text label underneath
      function previewCol(label, node, alignItems) {
        var f = af('Col/' + label, 'V', 8, 0, 0);
        f.counterAxisAlignItems = alignItems || 'CENTER';
        f.appendChild(node);
        f.appendChild(tx(label, 10, 'Medium', C.muted));
        return f;
      }

      // ── DOC FRAME ──────────────────────────────────────────────────────────
      var doc = figma.createFrame();
      doc.name = schema.name + ' — Documentation';
      doc.layoutMode = 'VERTICAL';
      doc.primaryAxisAlignItems = 'MIN';
      doc.counterAxisAlignItems = 'MIN';
      doc.itemSpacing  = 56;
      doc.paddingLeft  = doc.paddingRight  = 64;
      doc.paddingTop   = doc.paddingBottom = 64;
      doc.primaryAxisSizingMode = 'AUTO';
      doc.counterAxisSizingMode = 'AUTO';
      doc.fills       = [fill(C.surface)];
      doc.strokes     = [];
      doc.cornerRadius = 16;

      // ── 1. HEADER ──────────────────────────────────────────────────────────
      var header = af('Header', 'V', 12, 0, 0);

      var headerTop = af('Header/Top', 'H', 12, 0, 0);
      headerTop.counterAxisAlignItems = 'CENTER';
      var doc2 = schema.doc || {};
      headerTop.appendChild(tx(schema.name, 32, 'Bold', C.text));
      headerTop.appendChild(pill(doc2.status || 'Stable', C.greenBg, C.green, 22, 10));
      header.appendChild(headerTop);

      var descText = tx(doc2.description || schema.name, 13, 'Regular', C.secondary);
      descText.textAutoResize = 'HEIGHT';
      descText.resize(632, descText.height || 40);
      header.appendChild(descText);
      doc.appendChild(header);

      logComp('Header done', 'info');

      // ── AXIS VALUES (declare all upfront so sections can cross-reference) ────
      var variantVals = schema.variantAxis ? (schema.axes[schema.variantAxis] || []) : [];
      var sizeVals    = schema.sizeAxis    ? (schema.axes[schema.sizeAxis]    || []) : [];
      var stateVals   = schema.stateAxis   ? (schema.axes[schema.stateAxis]   || []) : [];
      var defSize  = sizeVals.length  ? sizeVals[Math.floor(sizeVals.length / 2)] : null;
      var defState = stateVals.length ? stateVals[0] : null;

      // Helper: place an array of previewCol nodes into wrapped rows so no row
      // exceeds maxW px. Returns a VERTICAL auto-layout wrapping frame.
      function wrappedRows(name, cols, colGap, rowGap, align, maxW) {
        var outer = af(name, 'V', rowGap, 0, 0);
        var row = null;
        var rowW = 0;
        for (var ri = 0; ri < cols.length; ri++) {
          var col = cols[ri];
          var cw  = col.width > 0 ? col.width : 100;
          var needed = rowW > 0 ? rowW + colGap + cw : cw;
          if (!row || needed > maxW) {
            row = af(name + '/Row', 'H', colGap, 0, 0);
            row.counterAxisAlignItems = align || 'CENTER';
            outer.appendChild(row);
            rowW = 0;
          }
          row.appendChild(col);
          rowW = rowW > 0 ? rowW + colGap + cw : cw;
        }
        return outer;
      }

      // ── 2. VARIANTS ────────────────────────────────────────────────────────
      if (variantVals.length) {
        var varS = section('Variants');
        var varCols = [];
        for (var i = 0; i < variantVals.length; i++) {
          varCols.push(previewCol(variantVals[i], inst(variantVals[i], defSize, defState)));
        }
        varS.appendChild(wrappedRows('Variants', varCols, 28, 20, 'CENTER', 600));
        doc.appendChild(varS);
      }

      // ── 3. SIZES ───────────────────────────────────────────────────────────
      if (sizeVals.length) {
        var sizeS = section('Sizes');
        var sizeCols = [];
        for (var i = 0; i < sizeVals.length; i++) {
          sizeCols.push(previewCol(sizeVals[i], inst(variantVals[0], sizeVals[i], defState)));
        }
        sizeS.appendChild(wrappedRows('Sizes', sizeCols, 28, 20, 'MAX', 600));
        doc.appendChild(sizeS);
      }

      // ── 4. STATES ──────────────────────────────────────────────────────────
      if (stateVals.length) {
        var stateS = section('States');
        var stateCols = [];
        for (var i = 0; i < stateVals.length; i++) {
          stateCols.push(previewCol(stateVals[i], inst(variantVals[0], defSize, stateVals[i])));
        }
        stateS.appendChild(wrappedRows('States', stateCols, 28, 20, 'CENTER', 600));
        doc.appendChild(stateS);
      }

      logComp('Variant/size/state rows done', 'info');

      // ── 5. ANATOMY ─────────────────────────────────────────────────────────
      var anatS = section('Anatomy');
      var anatContent = af('Anatomy/Content', 'H', 48, 32, 32);
      anatContent.counterAxisAlignItems = 'CENTER';
      anatContent.fills = [fill(C.bg)];
      anatContent.cornerRadius = 12;

      var anatPrev = doc2.anatomyPreview || {};

      // Find anatomy preview component — respects extra axes (e.g. Icon, Helper) in anatomyPreview
      var anatComp = compSet.findOne(function(n) {
        if (n.type !== 'COMPONENT') return false;
        var p = n.variantProperties;
        var wantV  = anatPrev.variant || variantVals[0];
        var wantSz = anatPrev.size    || sizeVals[sizeVals.length - 1] || null;
        var wantSt = anatPrev.state   || defState;
        if (schema.variantAxis && wantV  && p[schema.variantAxis] !== wantV)  return false;
        if (schema.sizeAxis    && wantSz && p[schema.sizeAxis]    !== wantSz) return false;
        if (schema.stateAxis   && wantSt && p[schema.stateAxis]   !== wantSt) return false;
        for (var axk in anatPrev) {
          if (axk === 'variant' || axk === 'size' || axk === 'state') continue;
          if (p[axk] !== undefined && p[axk] !== anatPrev[axk]) return false;
        }
        return true;
      });
      if (!anatComp) throw new Error('Anatomy preview component not found. Check anatomyPreview axes.');
      var anatInst = anatComp.createInstance();

      var cItems = doc2.anatomy || [
        { 'n': '1', 'label': 'Container', 'desc': 'Pill-shaped frame. Height is fixed per size token.' },
        { 'n': '2', 'label': 'Label',     'desc': 'Font size and weight vary per size.' },
        { 'n': '3', 'label': 'Padding',   'desc': 'Horizontal only — varies per size.' }
      ];

      // Plain wrapper frame — no layout, so pins can be absolutely positioned
      var previewWrap = figma.createFrame();
      previewWrap.name = 'Anatomy/Preview';
      previewWrap.fills = [];
      previewWrap.strokes = [];
      previewWrap.clipsContent = false;
      previewWrap.resize(Math.max(anatInst.width, 1), Math.max(anatInst.height, 1));
      previewWrap.appendChild(anatInst);
      anatInst.x = 0; anatInst.y = 0;

      // Numbered pin circles overlaid on the component at the pin % positions
      for (var pi2 = 0; pi2 < cItems.length; pi2++) {
        var aItem = cItems[pi2];
        if (!aItem.pin) continue;
        var px2 = Math.round(aItem.pin[0] / 100 * anatInst.width);
        var py2 = Math.round(aItem.pin[1] / 100 * anatInst.height);
        var pinF = figma.createFrame();
        pinF.name = 'Pin/' + aItem.n;
        pinF.layoutMode = 'HORIZONTAL';
        pinF.primaryAxisAlignItems = 'CENTER';
        pinF.counterAxisAlignItems = 'CENTER';
        pinF.primaryAxisSizingMode = 'FIXED';
        pinF.counterAxisSizingMode = 'FIXED';
        pinF.resize(12, 12);
        pinF.cornerRadius = 9999;
        pinF.fills = [fill(C.blue)];
        pinF.strokes = [];
        pinF.appendChild(tx(String(aItem.n), 7, 'Semi Bold', '#ffffff'));
        pinF.x = px2 - 6;
        pinF.y = py2 - 6;
        previewWrap.appendChild(pinF);
      }

      anatContent.appendChild(previewWrap);

      var callouts = af('Anatomy/Callouts', 'V', 14, 0, 0);
      for (var i = 0; i < cItems.length; i++) {
        var ci2 = cItems[i];
        var crow = af('CRow/' + ci2.n, 'H', 10, 0, 0);
        crow.counterAxisAlignItems = 'MIN';
        crow.appendChild(pill(ci2.n, C.blueBg, C.blueDark, 20, 8));
        var ctxt = af('CTxt/' + ci2.n, 'V', 3, 0, 0);
        ctxt.appendChild(tx(ci2.label, 11, 'Semi Bold', C.text));
        ctxt.appendChild(tx(ci2.desc,  10, 'Regular',   C.secondary));
        crow.appendChild(ctxt);
        callouts.appendChild(crow);
      }
      anatContent.appendChild(callouts);
      anatS.appendChild(anatContent);
      doc.appendChild(anatS);

      // ── 6. USAGE DO / DON'T ────────────────────────────────────────────────
      var usageS = section('Usage');
      var usageRow = af('Usage/Row', 'H', 16, 0, 0);
      usageRow.counterAxisAlignItems = 'MIN';

      function usageCard(type, accentHex, bgHex, borderHex, guidanceText, previewItems) {
        var card = figma.createFrame();
        card.name = 'Usage/' + type;
        card.layoutMode = 'VERTICAL';
        card.primaryAxisAlignItems = 'MIN';
        card.counterAxisAlignItems = 'MIN';
        card.itemSpacing = 0;
        card.paddingLeft = card.paddingRight = card.paddingTop = card.paddingBottom = 0;
        card.primaryAxisSizingMode = 'AUTO';
        card.counterAxisSizingMode = 'FIXED';
        card.resize(300, 100);
        card.cornerRadius = 12;
        card.fills   = [fill(C.surface)];
        card.strokes = [fill(borderHex)];
        card.strokeWeight = 1.5;
        card.strokeAlign  = 'INSIDE';

        var preview = figma.createFrame();
        preview.name = 'Preview';
        preview.layoutMode = 'HORIZONTAL';
        preview.primaryAxisAlignItems = 'CENTER';
        preview.counterAxisAlignItems = 'CENTER';
        preview.itemSpacing = 10;
        preview.paddingLeft = preview.paddingRight  = 24;
        preview.paddingTop  = preview.paddingBottom = 24;
        preview.primaryAxisSizingMode = 'FIXED';
        preview.counterAxisSizingMode = 'FIXED';
        preview.resize(300, 104);
        preview.fills   = [fill(bgHex)];
        preview.strokes = [];
        for (var pi = 0; pi < previewItems.length; pi++) {
          var pv = previewItems[pi];
          preview.appendChild(inst(pv.variant || null, pv.size || null, pv.state || null));
        }
        card.appendChild(preview);

        var strip = figma.createFrame();
        strip.name = 'Strip';
        strip.layoutMode = 'HORIZONTAL';
        strip.primaryAxisAlignItems = 'MIN';
        strip.counterAxisAlignItems = 'CENTER';
        strip.itemSpacing = 6;
        strip.paddingLeft = strip.paddingRight  = 16;
        strip.paddingTop  = strip.paddingBottom = 10;
        strip.primaryAxisSizingMode = 'FIXED';
        strip.counterAxisSizingMode = 'AUTO';
        strip.resize(300, 36);
        strip.fills   = [fill(bgHex)];
        strip.strokes = [];
        strip.appendChild(tx((type === 'Do' ? '✓  ' : '✗  ') + type, 11, 'Bold', accentHex));
        card.appendChild(strip);

        var guide = figma.createFrame();
        guide.name = 'Guidance';
        guide.layoutMode = 'HORIZONTAL';
        guide.primaryAxisAlignItems = 'MIN';
        guide.counterAxisAlignItems = 'MIN';
        guide.paddingLeft = guide.paddingRight  = 16;
        guide.paddingTop  = guide.paddingBottom = 14;
        guide.primaryAxisSizingMode = 'AUTO';
        guide.counterAxisSizingMode = 'AUTO';
        guide.fills = []; guide.strokes = [];
        var gt = tx(guidanceText, 10, 'Regular', C.secondary);
        gt.textAutoResize = 'HEIGHT';
        gt.resize(268, gt.height || 40);
        guide.appendChild(gt);
        card.appendChild(guide);
        return card;
      }

      var usageDo   = (doc2.usage && doc2.usage.do)   || {};
      var usageDont = (doc2.usage && doc2.usage.dont) || {};

      usageRow.appendChild(usageCard(
        'Do', '#0caf60', C.greenBg, C.greenBorder,
        usageDo.guidance   || '',
        usageDo.preview    || []
      ));

      usageRow.appendChild(usageCard(
        "Don't", '#f03030', C.redBg, C.redBorder,
        usageDont.guidance || '',
        usageDont.preview  || []
      ));

      usageS.appendChild(usageRow);
      doc.appendChild(usageS);

      logComp('Anatomy + usage done', 'info');

      // ── 7. DESIGN TOKENS TABLE ─────────────────────────────────────────────
      var tokenS = section('Design Tokens');

      var table = figma.createFrame();
      table.name = 'Token/Table';
      table.layoutMode = 'VERTICAL';
      table.primaryAxisAlignItems = 'MIN';
      table.counterAxisAlignItems = 'MIN';
      table.itemSpacing = 0;
      table.paddingLeft = table.paddingRight = table.paddingTop = table.paddingBottom = 0;
      table.primaryAxisSizingMode = 'AUTO';
      table.counterAxisSizingMode = 'FIXED';
      table.resize(632, 100);
      table.fills   = [fill(C.surface)];
      table.strokes = [fill(C.border)];
      table.strokeWeight = 1; table.strokeAlign = 'INSIDE';
      table.cornerRadius = 8;

      function trow(cols, isHeader, isAlt) {
        var f = figma.createFrame();
        f.layoutMode = 'HORIZONTAL';
        f.primaryAxisAlignItems = 'MIN';
        f.counterAxisAlignItems = 'CENTER';
        f.itemSpacing = 0;
        f.paddingLeft = f.paddingRight = f.paddingTop = f.paddingBottom = 0;
        f.primaryAxisSizingMode = 'FIXED';
        f.counterAxisSizingMode = 'FIXED';
        f.resize(632, 36);
        f.strokes = [];
        f.fills = isHeader ? [fill('#f0f2f7')]
                : isAlt    ? [fill(C.bg)]
                : [];
        var widths = [200, 152, 280];
        for (var i = 0; i < cols.length; i++) {
          var cell = figma.createFrame();
          cell.layoutMode = 'HORIZONTAL';
          cell.primaryAxisAlignItems = 'MIN';
          cell.counterAxisAlignItems = 'CENTER';
          cell.paddingLeft = cell.paddingRight  = 12;
          cell.paddingTop  = cell.paddingBottom = 0;
          cell.primaryAxisSizingMode = 'FIXED';
          cell.counterAxisSizingMode = 'FIXED';
          cell.resize(widths[i] || 150, 36);
          cell.fills = []; cell.strokes = [];
          var colColor = isHeader ? C.text : (i === 0 ? C.blue : (i === 2 ? C.secondary : C.text));
          var colStyle = isHeader ? 'Bold' : (i === 0 ? 'Medium' : 'Regular');
          cell.appendChild(tx(cols[i], 10, colStyle, colColor));
          f.appendChild(cell);
        }
        return f;
      }

      table.appendChild(trow(['Token', 'Value', 'Description'], true));
      var tokenData = doc2.tokens || [];
      for (var i = 0; i < tokenData.length; i++) {
        table.appendChild(trow(tokenData[i], false, i % 2 === 1));
      }
      tokenS.appendChild(table);
      doc.appendChild(tokenS);

      // ── 8. CODE SNIPPET ────────────────────────────────────────────────────
      var codeS = section('Code');

      var codeBlock = figma.createFrame();
      codeBlock.name = 'Code/Block';
      codeBlock.layoutMode = 'VERTICAL';
      codeBlock.primaryAxisAlignItems = 'MIN';
      codeBlock.counterAxisAlignItems = 'MIN';
      codeBlock.itemSpacing = 0;
      codeBlock.paddingLeft  = codeBlock.paddingRight  = 20;
      codeBlock.paddingTop   = codeBlock.paddingBottom = 20;
      codeBlock.primaryAxisSizingMode = 'AUTO';
      codeBlock.counterAxisSizingMode = 'AUTO';
      codeBlock.cornerRadius = 10;
      codeBlock.fills   = [fill(C.codeBg)];
      codeBlock.strokes = [];

      var rawLines = doc2.code || [];
      var lines = rawLines.map(function(l) {
        return { t: l.t, c: l.c === 'comment' ? C.codeComment : C.codeText };
      });
      for (var i = 0; i < lines.length; i++) {
        var lt = figma.createText();
        lt.fontName   = { family: 'Inter', style: 'Regular' };
        lt.fontSize   = 11;
        lt.lineHeight = { unit: 'PERCENT', value: 175 };
        lt.characters = lines[i].t;
        lt.fills      = [fill(lines[i].c)];
        codeBlock.appendChild(lt);
      }
      codeS.appendChild(codeBlock);
      doc.appendChild(codeS);

      // ── PLACE & ZOOM ───────────────────────────────────────────────────────
      var vp = figma.viewport.center;
      doc.x = Math.round(vp.x - doc.width / 2);
      doc.y = Math.round(vp.y - 300);

      figma.viewport.scrollAndZoomIntoView([doc]);
      logComp('Done!', 'ok');
      figma.ui.postMessage({ type: 'done-docs', text: schema.name + ' documentation frame created.' });

    } catch (e) {
      figma.ui.postMessage({ type: 'error-docs', text: e.message });
    }
    return;
  }

  // ── FIX COMPONENT → FILL CONTAINER ────────────────────────────────────────

  if (msg.type === 'fix-component-fill') {
    try {
      var searchName = (msg.name || '').trim().toLowerCase();
      if (!searchName) throw new Error('No component name provided.');

      function logFix(t, l) { figma.ui.postMessage({ type: 'log-fix', text: t, level: l || 'info' }); }

      var matchedSets = figma.root.findAll(function(n) {
        return (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
               n.name.toLowerCase().indexOf(searchName) !== -1;
      });

      if (!matchedSets.length) throw new Error('No component matching "' + msg.name + '" found. Make sure the library file is open.');
      logFix('Found ' + matchedSets.length + ' set(s) for "' + msg.name + '"', 'ok');

      // ── Scan first variant and print full layer tree ─────────────────────
      var firstRoot = matchedSets[0];
      var firstVariant = firstRoot.type === 'COMPONENT_SET' ? firstRoot.children[0] : firstRoot;
      if (firstVariant) {
        logFix('── Layer tree of first variant ──', 'info');
        function scanTree(node, indent) {
          var sizing = node.layoutSizingHorizontal ? '[W:' + node.layoutSizingHorizontal + ']' : '';
          var layout = node.layoutMode && node.layoutMode !== 'NONE' ? '[AL:' + node.layoutMode + ']' : '';
          logFix(indent + node.type + ' "' + node.name + '" ' +
                 Math.round(node.width) + '×' + Math.round(node.height) + ' ' + sizing + layout, 'info');
          if (node.children) {
            Array.from(node.children).forEach(function(c) { scanTree(c, indent + '  '); });
          }
        }
        scanTree(firstVariant, '');
        logFix('── Applying Fill ──', 'info');
      }

      // ── Apply Fill: target every node named "Field" inside matched sets ──
      var totalFixed = 0;

      matchedSets.forEach(function(root) {
        var fieldNodes = root.findAll(function(n) {
          return n.name === 'Field';
        });

        logFix('Found ' + fieldNodes.length + ' "Field" node(s) inside "' + root.name + '"', 'info');

        fieldNodes.forEach(function(field) {
          // Only target the rectangle (FRAME type) — skip any group/component wrappers
          if (field.type !== 'FRAME') {
            logFix('— skipping "Field" ' + field.id + ' (type: ' + field.type + ')', 'info');
            return;
          }
          try {
            field.layoutAlign            = 'STRETCH';
            field.layoutSizingHorizontal = 'FILL';
            totalFixed++;
            logFix('✓ ' + field.id + ' "Field" [FRAME] → STRETCH + FILL', 'ok');
          } catch (e) {
            logFix('✗ "Field" ' + field.id + ' → ' + e.message, 'info');
          }
        });
      });

      figma.ui.postMessage({ type: 'done-fix', text: totalFixed + ' layer(s) → Fill across ' + matchedSets.length + ' set(s). Check the layer tree above to confirm.' });

    } catch (e) {
      figma.ui.postMessage({ type: 'error-fix', text: e.message });
    }
    return;
  }

  // ── TEMPLATES ─────────────────────────────────────────────────────────────

  if (msg.type === 'run-template') {
    try {
      if (msg.template !== 'sign-in') throw new Error('Unknown template: ' + msg.template);

      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
      logTpl('Fonts loaded', 'info');

      // ── 1. variable map: local first, then import from library ─────────────
      var tplAllVars = figma.variables.getLocalVariables();
      var vMap = {};
      for (var tvi = 0; tvi < tplAllVars.length; tvi++) { vMap[tplAllVars[tvi].name] = tplAllVars[tvi]; }

      logTpl('Local variables: ' + tplAllVars.length, tplAllVars.length > 0 ? 'ok' : 'info');

      try {
        var libColls = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        logTpl('Library collections found: ' + libColls.length, libColls.length > 0 ? 'ok' : 'info');
        var importCount = 0;
        var importErrors = 0;
        for (var lci = 0; lci < libColls.length; lci++) {
          logTpl('  Collection: ' + libColls[lci].name, 'info');
          var libVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libColls[lci].key);
          for (var lvi = 0; lvi < libVars.length; lvi++) {
            if (!vMap[libVars[lvi].name]) {
              try {
                var imp = await figma.variables.importVariableByKeyAsync(libVars[lvi].key);
                vMap[imp.name] = imp;
                importCount++;
              } catch (e) { importErrors++; }
            }
          }
        }
        if (importCount > 0) {
          var sampleVars = Object.keys(vMap).slice(0, 5).join(', ');
          logTpl(importCount + ' library variables imported' + (importErrors > 0 ? ' (' + importErrors + ' errors)' : ''), 'ok');
          logTpl('  Sample names: ' + sampleVars + (Object.keys(vMap).length > 5 ? '…' : ''), 'info');
        } else {
          logTpl('No library variables imported' + (importErrors > 0 ? ' (' + importErrors + ' failed)' : '') + ' — using local only', 'info');
        }
      } catch (e) {
        logTpl('Library variables unavailable: ' + e.message, 'info');
      }

      // ── 2. text style map: local + scan existing text nodes for library styles
      var allTs2 = figma.getLocalTextStyles();
      var tsMap2 = {};
      for (var tsi = 0; tsi < allTs2.length; tsi++) { tsMap2[allTs2[tsi].name] = allTs2[tsi]; }

      // Also scan every TEXT node in the document — if they carry a library
      // textStyleId that resolves via getStyleById, add it to our map.
      var allTextNodes = figma.root.findAllWithCriteria({ types: ['TEXT'] });
      for (var tni = 0; tni < allTextNodes.length; tni++) {
        var sid = allTextNodes[tni].textStyleId;
        if (sid && typeof sid === 'string') {
          var sty = figma.getStyleById(sid);
          if (sty && !tsMap2[sty.name]) { tsMap2[sty.name] = sty; }
        }
      }

      var tsCount = Object.keys(tsMap2).length;
      if (tsCount > 0) {
        var sampleTs = Object.keys(tsMap2).slice(0, 5).join(', ');
        logTpl('Text styles (' + tsCount + '): ' + sampleTs + (tsCount > 5 ? '…' : ''), 'ok');
      } else {
        logTpl('No text styles found — text uses raw font values', 'info');
      }

      // ── design token palette ───────────────────────────────────────────────
      var HEX = {
        bgPage:    '#f8f9fc',  bgSurface: '#ffffff',
        text:      '#111422',  secondary: '#464d6b',  tertiary: '#9198b4',
        border:    '#e2e5ef',  brand:     '#0068ff',  blue400:  '#3d87ff',
        green:     '#0caf60'
      };
      var TOK = {
        bgPage:    'color/bg/page',     bgSurface: 'color/bg/surface',
        text:      'color/text/primary', secondary: 'color/text/secondary',
        tertiary:  'color/text/tertiary', border:   'color/border/default',
        brand:     'color/brand'
      };

      // ── paint helper ───────────────────────────────────────────────────────
      function tplPaint(hex, tok) {
        var c = hexToRgba(hex);
        var paint = { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a !== undefined ? c.a : 1 };
        if (tok && vMap[tok]) paint = figma.variables.setBoundVariableForPaint(paint, 'color', vMap[tok]);
        return paint;
      }

      // ── gradient fill ──────────────────────────────────────────────────────
      function gradFill(hexA, hexB, angleDeg) {
        var rad = ((angleDeg || 135) - 90) * Math.PI / 180;
        var cos = Math.cos(rad), sin = Math.sin(rad);
        var cA = hexToRgba(hexA), cB = hexToRgba(hexB);
        return {
          type: 'GRADIENT_LINEAR',
          gradientTransform: [
            [cos, sin, (1 - cos) / 2 - sin / 2],
            [-sin, cos,  sin / 2 + (1 - cos) / 2]
          ],
          gradientStops: [
            { position: 0, color: { r: cA.r, g: cA.g, b: cA.b, a: 1 } },
            { position: 1, color: { r: cB.r, g: cB.g, b: cB.b, a: 1 } }
          ]
        };
      }

      // ── auto-layout frame ──────────────────────────────────────────────────
      function tplFr(name, dir, gap) {
        var f = figma.createFrame();
        f.name = name;
        f.layoutMode            = dir === 'V' ? 'VERTICAL' : 'HORIZONTAL';
        f.primaryAxisAlignItems = 'MIN';
        f.counterAxisAlignItems = 'MIN';
        f.itemSpacing           = gap || 0;
        f.paddingLeft = f.paddingRight = f.paddingTop = f.paddingBottom = 0;
        f.primaryAxisSizingMode = 'AUTO';
        f.counterAxisSizingMode = 'AUTO';
        f.fills   = [];
        f.strokes = [];
        return f;
      }

      // ── text node (optional text style lookup) ────────────────────────────
      function tplTx(chars, size, style, hexC, tokC, tsName) {
        var n = figma.createText();
        if (tsName && tsMap2[tsName]) {
          n.textStyleId = tsMap2[tsName].id;
        } else {
          n.fontName = { family: 'Inter', style: style || 'Regular' };
          n.fontSize = size || 14;
        }
        n.characters = chars;
        n.fills = [tplPaint(hexC || HEX.text, tokC || TOK.text)];
        return n;
      }

      // ── component set lookup ──────────────────────────────────────────────
      // Finds a COMPONENT_SET (or COMPONENT) by name — checks:
      //   1. Local nodes in the document (any page)
      //   2. Instances already in the document → mainComponent.parent
      // If still not found we fall back to primitives.
      function findCompSet(name) {
        // 1. Direct search for a component set or bare component in the doc
        var found = figma.root.findOne(function(n) {
          return n.type === 'COMPONENT_SET' && n.name === name;
        });
        if (!found) {
          found = figma.root.findOne(function(n) {
            return n.type === 'COMPONENT' && n.name === name;
          });
        }
        if (found) return found;

        // 2. Look through all instances — mainComponent.parent may be a library set
        var allInst = figma.root.findAllWithCriteria({ types: ['INSTANCE'] });
        for (var ii = 0; ii < allInst.length; ii++) {
          var mc = allInst[ii].mainComponent;
          if (!mc) continue;
          if (mc.parent && mc.parent.type === 'COMPONENT_SET' && mc.parent.name === name) {
            return mc.parent;
          }
          if (mc.name === name) return mc;
        }
        return null;
      }

      function findVariant(set, props) {
        if (!set) return null;
        return set.findOne(function(n) {
          if (n.type !== 'COMPONENT') return false;
          var p = n.variantProperties;
          var keys = Object.keys(props);
          for (var ki = 0; ki < keys.length; ki++) {
            if (p[keys[ki]] !== props[keys[ki]]) return false;
          }
          return true;
        }) || set.children[0] || null;
      }

      // ── SVG icon ──────────────────────────────────────────────────────────
      function tplIcon(svgStr, sz) {
        var n = figma.createNodeFromSvg(svgStr);
        n.resize(sz || 16, sz || 16);
        return n;
      }

      // ── SVG strings ───────────────────────────────────────────────────────
      var SVG_MAIL   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="#9198b4" stroke-width="1.25"/><path d="M1.5 5.5L8 9.5L14.5 5.5" stroke="#9198b4" stroke-width="1.25" stroke-linejoin="round"/></svg>';
      var SVG_LOCK   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7" width="9" height="7" rx="1.5" stroke="#9198b4" stroke-width="1.25"/><path d="M5 7V5C5 3.343 6.343 2 8 2s3 1.343 3 3v2" stroke="#9198b4" stroke-width="1.25" stroke-linecap="round"/><circle cx="8" cy="10.5" r="1" fill="#9198b4"/></svg>';
      var SVG_EYE    = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M1.5 8s2-4 6.5-4 6.5 4 6.5 4-2 4-6.5 4-6.5-4-6.5-4z" stroke="#9198b4" stroke-width="1.25" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="#9198b4" stroke-width="1.25"/></svg>';
      var SVG_GOOGLE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"><path d="M17.1 9.2c0-.6-.05-1.2-.16-1.77H9v3.35h4.54a3.88 3.88 0 0 1-1.68 2.55v2.12h2.71C16.14 13.86 17.1 11.7 17.1 9.2Z" fill="#4285F4"/><path d="M9 17.5c2.27 0 4.17-.75 5.56-2.04l-2.71-2.12C11.04 14 10.07 14.3 9 14.3c-2.19 0-4.05-1.48-4.71-3.47H1.5v2.19A8.5 8.5 0 0 0 9 17.5Z" fill="#34A853"/><path d="M4.29 10.83A5.1 5.1 0 0 1 4.02 9c0-.64.11-1.26.27-1.83V4.98H1.5A8.5 8.5 0 0 0 .5 9c0 1.37.33 2.67.91 3.83l2.88-2Z" fill="#FBBC04"/><path d="M9 3.7c1.24 0 2.35.43 3.23 1.26l2.42-2.42A8.47 8.47 0 0 0 9 .5 8.5 8.5 0 0 0 1.5 4.98l2.78 2.19C4.95 5.18 6.81 3.7 9 3.7Z" fill="#EA4335"/></svg>';
      var SVG_APPLE  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"><path d="M13.22 9.49c-.02-1.78 1.46-2.64 1.53-2.68-1.33-1.95-3.4-1.7-3.4-1.7-1.44-.14-2.82.85-3.55.85-.73 0-1.84-.83-3.04-.81C2.96 5.18 1.4 6.34.62 8.03c-1.57 2.72-.4 6.74 1.12 8.94.75 1.08 1.64 2.29 2.8 2.25 1.13-.05 1.56-.73 2.92-.73 1.37 0 1.76.73 2.97.7 1.21-.03 1.98-1.1 2.72-2.18.87-1.25 1.22-2.46 1.24-2.52-.03-.01-2.37-.91-2.39-3.61l.01.11Z" fill="#1D1D1F"/><path d="M11.44 4.04c.62-.75 1.04-1.8.92-2.85-.9.04-1.98.6-2.62 1.34-.58.67-1.08 1.74-.95 2.76 1 .08 2.03-.51 2.65-1.25Z" fill="#1D1D1F"/></svg>';
      var SVG_HEX    = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none"><path d="M9 2L15.5 5.75V12.25L9 16L2.5 12.25V5.75L9 2Z" fill="white" opacity="0.9"/><path d="M9 5.5L12.5 7.5V11.5L9 13.5L5.5 11.5V7.5L9 5.5Z" fill="white"/></svg>';
      var SVG_DOT    = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill="#0caf60"/></svg>';

      // ── input field builder (tries library component first) ───────────────
      var _inputSet = findCompSet('Input');
      var _btnSet   = findCompSet('Button');
      logTpl('Input:  ' + (_inputSet ? 'library component ✓' : 'primitive fallback'), _inputSet ? 'ok' : 'info');
      logTpl('Button: ' + (_btnSet   ? 'library component ✓' : 'primitive fallback'), _btnSet   ? 'ok' : 'info');
      if (!_inputSet || !_btnSet) {
        logTpl('Tip: drag one Button + one Input from the Assets panel into this file, then re-run to use real library components.', 'info');
      }

      function tplInput(labelText, placeholder, leadSvg, trailSvg) {
        // Try to use a real Input component instance
        if (_inputSet) {
          var iconVal = leadSvg ? 'Leading' : 'None';
          var comp = findVariant(_inputSet, { State: 'Default', Size: 'LG', Icon: iconVal })
                  || findVariant(_inputSet, { State: 'Default', Size: 'MD', Icon: iconVal })
                  || findVariant(_inputSet, { State: 'Default' });
          if (comp) {
            var inst = comp.createInstance();
            inst.name = 'Input/' + labelText;
            // setProperties only works if text is exposed as a component property.
            // Directly override the text nodes inside the instance instead.
            try { inst.setProperties({ Label: labelText, Placeholder: placeholder }); } catch (e) {}
            inst.findAll(function(n) { return n.type === 'TEXT'; }).forEach(function(tn) {
              if (tn.characters === 'Label') {
                try { tn.characters = labelText; } catch(e) {}
              } else if (tn.characters === 'Placeholder') {
                try { tn.characters = placeholder; } catch(e) {}
              }
            });
            inst.resize(342, inst.height || 72);
            return inst;
          }
        }

        // Fallback: primitive build
        var grp = tplFr('Input/' + labelText, 'V', 4);

        var lbl = tplTx(labelText, 12, 'Medium', HEX.text, TOK.text, 'Label/Small');
        grp.appendChild(lbl);

        var box = tplFr('Field', 'H', 8);
        box.counterAxisAlignItems = 'CENTER';
        box.counterAxisSizingMode = 'FIXED';
        box.primaryAxisSizingMode = 'FIXED';
        box.paddingLeft   = 12;
        box.paddingRight  = 12;
        box.cornerRadius  = 8;
        box.fills         = [tplPaint(HEX.bgSurface, TOK.bgSurface)];
        box.strokes       = [tplPaint(HEX.border, TOK.border)];
        box.strokeWeight  = 1;
        box.strokeAlign   = 'INSIDE';
        box.resize(342, 48);

        if (leadSvg) {
          var li = tplIcon(leadSvg, 16);
          li.name = 'Icon/Lead';
          box.appendChild(li);
          li.layoutSizingHorizontal = 'FIXED';
          li.layoutSizingVertical   = 'FIXED';
        }

        var ph = tplTx(placeholder, 14, 'Regular', HEX.tertiary, TOK.tertiary, 'Body/Default');
        ph.layoutGrow = 1;
        box.appendChild(ph);

        if (trailSvg) {
          var ti = tplIcon(trailSvg, 16);
          ti.name = 'Icon/Trail';
          box.appendChild(ti);
          ti.layoutSizingHorizontal = 'FIXED';
          ti.layoutSizingVertical   = 'FIXED';
        }

        grp.appendChild(box);
        return grp;
      }

      // ── button builder (tries library component first) ────────────────────
      function tplBtn(labelText, isPrimary, iconSvg) {
        // Try to use a real Button component instance
        if (_btnSet) {
          var variant = isPrimary ? 'Primary' : 'Secondary';
          var comp = findVariant(_btnSet, { Variant: variant, Size: 'LG', State: 'Default' })
                  || findVariant(_btnSet, { Variant: variant, Size: 'MD', State: 'Default' })
                  || findVariant(_btnSet, { Variant: variant });
          if (comp) {
            var inst = comp.createInstance();
            inst.name = 'Button/' + labelText;
            try { inst.setProperties({ Label: labelText }); } catch (e) {}
            inst.findAll(function(n) { return n.type === 'TEXT'; }).forEach(function(tn) {
              if (tn.characters === 'Button' || tn.characters === 'Label') {
                try { tn.characters = labelText; } catch(e) {}
              }
            });
            inst.resize(342, inst.height || 52);
            return inst;
          }
        }

        // Fallback: primitive build
        var btn = tplFr('Button/' + labelText, 'H', 8);
        btn.primaryAxisAlignItems = 'CENTER';
        btn.counterAxisAlignItems = 'CENTER';
        btn.counterAxisSizingMode = 'FIXED';
        btn.primaryAxisSizingMode = 'FIXED';
        btn.cornerRadius = 9999;
        btn.paddingLeft  = btn.paddingRight = 24;

        if (isPrimary) {
          btn.fills   = [gradFill(HEX.brand, HEX.blue400, 160)];
          btn.strokes = [];
          btn.effects = [{ type: 'DROP_SHADOW', blendMode: 'NORMAL', visible: true,
            color: { r: 0, g: 0.408, b: 1, a: 0.28 },
            offset: { x: 0, y: 4 }, radius: 14, spread: 0 }];
        } else {
          btn.fills   = [tplPaint(HEX.bgSurface, TOK.bgSurface)];
          btn.strokes = [tplPaint(HEX.border, TOK.border)];
          btn.strokeWeight = 1;
          btn.strokeAlign  = 'INSIDE';
          btn.effects = [{ type: 'DROP_SHADOW', blendMode: 'NORMAL', visible: true,
            color: { r: 0.067, g: 0.078, b: 0.133, a: 0.06 },
            offset: { x: 0, y: 1 }, radius: 2, spread: 0 }];
        }

        if (iconSvg) {
          var ic = tplIcon(iconSvg, 18);
          ic.name = 'Icon';
          btn.appendChild(ic);
          ic.layoutSizingHorizontal = 'FIXED';
          ic.layoutSizingVertical   = 'FIXED';
        }

        var lbl = tplTx(
          labelText,
          isPrimary ? 16 : 14,
          isPrimary ? 'Bold' : 'Medium',
          isPrimary ? '#ffffff' : HEX.text,
          isPrimary ? null : TOK.text,
          isPrimary ? 'Label/Large' : 'Label/Default'
        );
        btn.appendChild(lbl);
        btn.resize(342, 52);
        return btn;
      }

      // ── outer screen frame ────────────────────────────────────────────────
      var screen = figma.createFrame();
      screen.name = 'Sign In';
      screen.layoutMode            = 'VERTICAL';
      screen.primaryAxisAlignItems = 'MIN';
      screen.counterAxisAlignItems = 'MIN';
      screen.itemSpacing           = 0;
      screen.paddingTop            = 52;
      screen.paddingBottom         = 0;
      screen.paddingLeft           = screen.paddingRight = 24;
      screen.primaryAxisSizingMode = 'AUTO';
      screen.counterAxisSizingMode = 'FIXED';
      screen.fills   = [tplPaint(HEX.bgPage, TOK.bgPage)];
      screen.strokes = [];
      screen.resize(390, 200);

      logTpl('Building layout…', 'info');

      // ── 1. LOGO BAR ───────────────────────────────────────────────────────
      var logoBar = tplFr('Logo Bar', 'H', 8);
      logoBar.counterAxisAlignItems = 'CENTER';

      var mark = figma.createFrame();
      mark.name        = 'Logo/Mark';
      mark.layoutMode  = 'NONE';
      mark.resize(32, 32);
      mark.cornerRadius = 8;
      mark.fills        = [gradFill('#0068ff', '#3d87ff', 135)];
      mark.strokes      = [];
      var hexIc = tplIcon(SVG_HEX, 18);
      hexIc.name = 'Hex'; hexIc.x = 7; hexIc.y = 7;
      mark.appendChild(hexIc);

      logoBar.appendChild(mark);
      mark.layoutSizingHorizontal = 'FIXED';
      mark.layoutSizingVertical   = 'FIXED';

      var logoTxt = tplTx('Copycat', 16, 'Bold', HEX.text, TOK.text);
      logoTxt.letterSpacing = { unit: 'PERCENT', value: -2 };
      logoBar.appendChild(logoTxt);

      screen.appendChild(logoBar);
      logoBar.layoutSizingHorizontal = 'FILL';

      // ── 2. SPACER ─────────────────────────────────────────────────────────
      var sp1 = figma.createRectangle();
      sp1.name = 'Spacer'; sp1.fills = []; sp1.resize(342, 32);
      screen.appendChild(sp1);
      sp1.layoutSizingHorizontal = 'FILL';

      // ── 3. HEADING ────────────────────────────────────────────────────────
      var headingBlk = tplFr('Heading', 'V', 6);
      var titleNd    = tplTx('Welcome back! 👋', 24, 'Bold', HEX.text, TOK.text, 'Heading/H4');
      if (!tsMap2['Heading/H4']) {
        titleNd.letterSpacing = { unit: 'PERCENT', value: -2.5 };
        titleNd.lineHeight    = { unit: 'PERCENT', value: 120 };
      }
      headingBlk.appendChild(titleNd);

      var subNd = tplTx("We're glad you're back. Sign in to pick up where you left off.", 14, 'Regular', HEX.secondary, TOK.secondary, 'Body/Default');
      if (!tsMap2['Body/Default']) { subNd.lineHeight = { unit: 'PERCENT', value: 150 }; }
      headingBlk.appendChild(subNd);

      screen.appendChild(headingBlk);
      headingBlk.layoutSizingHorizontal = 'FILL';
      titleNd.layoutSizingHorizontal    = 'FILL';
      subNd.layoutSizingHorizontal      = 'FILL';

      // ── 4. SPACER ─────────────────────────────────────────────────────────
      var sp2 = figma.createRectangle();
      sp2.name = 'Spacer'; sp2.fills = []; sp2.resize(342, 24);
      screen.appendChild(sp2);
      sp2.layoutSizingHorizontal = 'FILL';

      // ── 5. FORM ───────────────────────────────────────────────────────────
      var form = tplFr('Form', 'V', 16);

      var emailFld = tplInput('Email', 'name@example.com', SVG_MAIL, null);
      form.appendChild(emailFld);
      emailFld.layoutSizingHorizontal = 'FILL';
      // Only reach into internals when it's a primitive frame — instances don't allow editing internal nodes
      if (emailFld.type === 'FRAME') {
        var eBox = emailFld.findOne(function(n) { return n.name === 'Field'; });
        if (eBox) { eBox.layoutSizingHorizontal = 'FILL'; }
      }

      var pwFld = tplInput('Password', 'your secure password', SVG_LOCK, SVG_EYE);
      form.appendChild(pwFld);
      pwFld.layoutSizingHorizontal = 'FILL';
      if (pwFld.type === 'FRAME') {
        var pBox = pwFld.findOne(function(n) { return n.name === 'Field'; });
        if (pBox) { pBox.layoutSizingHorizontal = 'FILL'; }
      }

      var forgotRow = tplFr('Forgot Row', 'H', 0);
      forgotRow.primaryAxisAlignItems = 'MAX';
      forgotRow.counterAxisSizingMode = 'FIXED';
      forgotRow.resize(342, 20);
      var forgotTx = tplTx('Forgot your password?', 12, 'Medium', HEX.brand, TOK.brand);
      forgotRow.appendChild(forgotTx);
      form.appendChild(forgotRow);
      forgotRow.layoutSizingHorizontal = 'FILL';

      var signInBtn = tplBtn('Sign In', true, null);
      form.appendChild(signInBtn);
      signInBtn.layoutSizingHorizontal = 'FILL';

      screen.appendChild(form);
      form.layoutSizingHorizontal = 'FILL';

      logTpl('Form done', 'info');

      // ── 6. SPACER ─────────────────────────────────────────────────────────
      var sp3 = figma.createRectangle();
      sp3.name = 'Spacer'; sp3.fills = []; sp3.resize(342, 24);
      screen.appendChild(sp3);
      sp3.layoutSizingHorizontal = 'FILL';

      // ── 7. DIVIDER ────────────────────────────────────────────────────────
      var divRow = tplFr('Divider', 'H', 12);
      divRow.counterAxisAlignItems = 'CENTER';
      divRow.counterAxisSizingMode = 'FIXED';

      var line1 = figma.createRectangle();
      line1.name = 'Line'; line1.fills = [tplPaint(HEX.border, TOK.border)]; line1.resize(10, 1);
      divRow.appendChild(line1);
      line1.layoutGrow = 1;

      var divTx = tplTx('or sign in with', 12, 'Regular', HEX.tertiary, TOK.tertiary);
      divRow.appendChild(divTx);

      var line2 = figma.createRectangle();
      line2.name = 'Line'; line2.fills = [tplPaint(HEX.border, TOK.border)]; line2.resize(10, 1);
      divRow.appendChild(line2);
      line2.layoutGrow = 1;

      divRow.resize(342, 20);
      screen.appendChild(divRow);
      divRow.layoutSizingHorizontal = 'FILL';

      // ── 8. SPACER ─────────────────────────────────────────────────────────
      var sp4 = figma.createRectangle();
      sp4.name = 'Spacer'; sp4.fills = []; sp4.resize(342, 24);
      screen.appendChild(sp4);
      sp4.layoutSizingHorizontal = 'FILL';

      // ── 9. SOCIAL BUTTONS ─────────────────────────────────────────────────
      var socialGrp = tplFr('Social', 'V', 12);
      var googleBtn = tplBtn('Continue with Google', false, SVG_GOOGLE);
      var appleBtn  = tplBtn('Continue with Apple',  false, SVG_APPLE);
      socialGrp.appendChild(googleBtn);
      socialGrp.appendChild(appleBtn);
      googleBtn.layoutSizingHorizontal = 'FILL';
      appleBtn.layoutSizingHorizontal  = 'FILL';
      screen.appendChild(socialGrp);
      socialGrp.layoutSizingHorizontal = 'FILL';

      logTpl('Social done', 'info');

      // ── 10. FLEX SPACER ───────────────────────────────────────────────────
      var flexSp = figma.createRectangle();
      flexSp.name = 'Spacer/Flex'; flexSp.fills = []; flexSp.resize(342, 1);
      screen.appendChild(flexSp);
      flexSp.layoutSizingHorizontal = 'FILL';
      flexSp.layoutGrow = 1;

      // ── 11. TRUST ROW ─────────────────────────────────────────────────────
      var trustRow = tplFr('Trust', 'H', 6);
      trustRow.primaryAxisAlignItems = 'CENTER';
      trustRow.counterAxisAlignItems = 'CENTER';
      trustRow.counterAxisSizingMode = 'FIXED';

      var dotIc = tplIcon(SVG_DOT, 6);
      dotIc.name = 'Dot';
      trustRow.appendChild(dotIc);
      dotIc.layoutSizingHorizontal = 'FIXED';
      dotIc.layoutSizingVertical   = 'FIXED';

      var trustTx = tplTx('Your data is always safe and encrypted 🔒', 10, 'Medium', HEX.tertiary, TOK.tertiary);
      trustTx.letterSpacing = { unit: 'PERCENT', value: 4 };
      trustRow.appendChild(trustTx);
      trustRow.resize(342, 20);
      screen.appendChild(trustRow);
      trustRow.layoutSizingHorizontal = 'FILL';

      // ── 12. FOOTER ROW ────────────────────────────────────────────────────
      var footerRow = tplFr('Footer', 'H', 4);
      footerRow.primaryAxisAlignItems = 'CENTER';
      footerRow.counterAxisAlignItems = 'CENTER';
      footerRow.counterAxisSizingMode = 'FIXED';
      footerRow.paddingTop    = 8;
      footerRow.paddingBottom = 32;

      var ftTx   = tplTx("New here?", 14, 'Regular', HEX.secondary, TOK.secondary);
      var suLink = tplTx(' Create a free account', 14, 'Semi Bold', HEX.brand, TOK.brand);
      footerRow.appendChild(ftTx);
      footerRow.appendChild(suLink);
      footerRow.resize(342, 60);
      screen.appendChild(footerRow);
      footerRow.layoutSizingHorizontal = 'FILL';

      // ── fix to standard mobile height ──────────────────────────────────────
      screen.primaryAxisSizingMode = 'FIXED';
      screen.resize(390, 844);

      // ── center in viewport ─────────────────────────────────────────────────
      var vpcenter = figma.viewport.center;
      screen.x = Math.round(vpcenter.x - 195);
      screen.y = Math.round(vpcenter.y - 422);

      figma.viewport.scrollAndZoomIntoView([screen]);
      logTpl('Screen ready!', 'ok');
      figma.ui.postMessage({ type: 'done-tpl', text: 'Sign In — 390×844 screen created.' });

    } catch (e) {
      logTpl(e.message, 'err');
      figma.ui.postMessage({ type: 'error-tpl', text: e.message });
    }
    return;
  }

};
