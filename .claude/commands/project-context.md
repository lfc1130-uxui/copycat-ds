You are being asked to load the full context of the **Copycat Design System** project before starting any work. Read every file listed below, then output a structured briefing. Do not skip any file.

---

## Files to read

1. `design.md` — design reference: tokens, components, patterns, dark mode, a11y rules
2. `package.json` — project name, scripts, dependencies
3. `tokens/tokens.json` — raw token structure (primitives + semantic light/dark)
4. `src/components/Button/Button.tsx` — Button props/variants
5. `src/components/Badge/Badge.tsx` — Badge props/variants
6. `src/components/Icon/Icon.tsx` — Icon props/available icons
7. `src/components/Input/Input.tsx` — Input props/variants
8. `src/components/Select/Select.tsx` — Select props/variants
9. `.storybook/main.ts` — Storybook config
10. `playground/dashboard.html` — current dashboard (home banking UI)
11. `scripts/push-to-figma.ps1` — Figma Variables sync script

---

## Briefing format to output after reading

### Project
- Name, repo, purpose, stack (no framework — vanilla HTML/CSS/TS + React for Storybook)

### Token system
- How primitives vs semantic tokens work
- Light/dark mode mechanism (`.dark` class on `<html>`)
- Key CSS custom property prefixes (--color-*, --space-*, --radius-*, --shadow-*)

### Components (one line each)
List each component with its key props and variants.

### Dashboard (`playground/dashboard.html`)
- What screens/sections exist
- Any JS state (balance toggle, theme toggle)
- Known design details (glass navbar, collapse animation, etc.)

### Scripts & tooling
- `npm run storybook` — what it does
- `scripts/push-to-figma.ps1` — what it does and how to run it
- `cc:publish` — Figma Code Connect

### GitHub
- Repo: https://github.com/lfc1130-uxui/copycat-ds
- Branch: master

### Pending / notes
List anything unfinished, known issues, or important caveats found in the files.

---

If `$ARGUMENTS` were provided, also address: $ARGUMENTS
