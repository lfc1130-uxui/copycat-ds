# Copycat Design System — Design Reference

This document is the single reference for anyone using this design system in a new project, page, or component. It covers tokens, components, patterns, and usage rules.

---

## Contents

1. [What is this system?](#what-is-this-system)
2. [How to use it in a new project](#how-to-use-it-in-a-new-project)
3. [Design tokens](#design-tokens)
   - [Colors](#colors)
   - [Typography](#typography)
   - [Spacing](#spacing)
   - [Shadows & Elevation](#shadows--elevation)
   - [Border radius](#border-radius)
   - [Motion](#motion)
4. [Components](#components)
   - [Button](#button)
   - [Badge](#badge)
   - [Icon](#icon)
   - [Input](#input)
   - [Select](#select)
5. [Layout patterns](#layout-patterns)
6. [Dark mode](#dark-mode)
7. [Accessibility rules](#accessibility-rules)
8. [Figma connection](#figma-connection)

---

## What is this system?

This is a React component library and design token system for building consistent UIs. It provides:

- **Design tokens** — CSS variables for colors, type, spacing, etc. defined once in `src/styles/tokens.css`
- **5 core components** — Button, Badge, Icon, Input, Select — each with variants, sizes, and states
- **Figma integration** — Code Connect files that map Figma components directly to code
- **Storybook** — Interactive component explorer at `npm run storybook`

The system uses **React + TypeScript + vanilla CSS**. There is no Tailwind, no CSS-in-JS.

---

## How to use it in a new project

### Step 1 — Import tokens

Add this import once at the top level of your app (e.g. `main.tsx` or `App.tsx`):

```tsx
import '@copycat/design-system/src/styles/tokens.css';
```

This makes all design token CSS variables available everywhere in your app.

### Step 2 — Import components

```tsx
import { Button, Badge, Icon, Input, Select } from '@copycat/design-system/src';
```

### Step 3 — Apply dark mode

To activate dark mode, add the `dark` class to your `<html>` element:

```tsx
document.documentElement.classList.add('dark');
```

---

## Design tokens

Tokens are CSS custom properties (variables). Always use tokens instead of raw values in custom styles — this keeps the UI consistent and makes dark mode work automatically.

### Colors

The color system has two layers:

**Primitives** — the raw palette (never use these directly in components):
```
--blue-50 … --blue-950
--neutral-0 … --neutral-950
--green-50 … --green-900
--amber-50 … --amber-900
--red-50 … --red-900
```

**Semantic tokens** — use these in your code. They describe *intent*, not color:

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--color-bg-page` | `#f8f9fc` | `#090b14` | Page background |
| `--color-bg-surface` | `#ffffff` | `#111422` | Cards, panels, modals |
| `--color-bg-subtle` | `#f0f2f7` | `#1e2235` | Hover states, sidebars |
| `--color-bg-muted` | `#e2e5ef` | `#313750` | Active states |
| `--color-bg-disabled` | `#e2e5ef` | `#3a3a3a` | Disabled backgrounds |
| `--color-text-primary` | `#111422` | `#f8f9fc` | Body text, headings |
| `--color-text-secondary` | `#464d6b` | `#c8cde0` | Labels, captions |
| `--color-text-tertiary` | `#9198b4` | `#636a88` | Placeholder, hints |
| `--color-text-disabled` | `#9198b4` | `#6e6e6e` | Disabled labels |
| `--color-text-link` | `#0054cc` | `#84b3ff` | Links |
| `--color-border-default` | `#e2e5ef` | `#313750` | Dividers, card borders |
| `--color-border-strong` | `#c8cde0` | `#464d6b` | Emphasized borders |
| `--color-border-focus` | `#0068ff` | `#3d87ff` | Focus rings |
| `--color-brand` | `#0068ff` | `#3d87ff` | Primary actions, links |
| `--color-brand-subtle` | `#eff5ff` | `rgba(0,104,255,0.12)` | Brand tinted backgrounds |
| `--color-success` | `#0caf60` | `#2abd76` | Positive states |
| `--color-warning` | `#ff9a0d` | `#fba32d` | Warning states |
| `--color-error` | `#f03030` | `#ff4040` | Error states, danger actions |
| `--color-info` | `#0068ff` | `#3d87ff` | Informational states |

**Usage example:**
```css
.my-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  color: var(--color-text-primary);
}
```

### Typography

| Token | Value | Use for |
|---|---|---|
| `--font-sans` | Inter, Segoe UI, system-ui | Body text, UI labels |
| `--font-mono` | JetBrains Mono, Cascadia Code | Code, API keys |
| `--text-xs` | 10px | Tiny labels, badges |
| `--text-sm` | 12px | Captions, helper text |
| `--text-base` | 14px | Body text (default) |
| `--text-md` | 16px | Slightly larger body |
| `--text-lg` | 18px | Section headings |
| `--text-xl` | 20px | Page subheadings |
| `--text-2xl` | 24px | Page headings |
| `--text-4xl` | 36px | Hero text |
| `--weight-regular` | 400 | Body |
| `--weight-medium` | 500 | Labels, buttons |
| `--weight-semibold` | 600 | Headings |
| `--weight-bold` | 700 | Strong emphasis |
| `--leading-normal` | 1.5 | Body text |
| `--leading-tight` | 1.25 | Headings |
| `--leading-none` | 1 | Buttons, badges |

### Spacing

Spacing tokens follow a 4px base grid:

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

**Rule:** always use spacing tokens for margin, padding, and gap — never raw pixels.

### Shadows & Elevation

| Token | Use for |
|---|---|
| `--shadow-xs` | Subtle lift (inputs) |
| `--shadow-sm` | Cards, buttons |
| `--shadow-md` | Dropdowns, popovers |
| `--shadow-lg` | Modals, dialogs |
| `--shadow-xl` | Floating panels |
| `--shadow-2xl` | Full-screen overlays |
| `--shadow-brand` | Focus ring (brand color) |
| `--shadow-inner` | Inset fields, pressed states |

### Border radius

| Token | Value | Use for |
|---|---|---|
| `--radius-xs` | 2px | Very small badges |
| `--radius-sm` | 4px | Inputs, small cards |
| `--radius-md` | 6px | Dropdowns |
| `--radius-lg` | 8px | Cards, panels |
| `--radius-xl` | 12px | Large cards |
| `--radius-2xl` | 16px | Modals |
| `--radius-full` | 9999px | Pills, buttons, avatars |

### Motion

| Token | Value | Use for |
|---|---|---|
| `--duration-100` | 100ms | Micro (transform, scale) |
| `--duration-150` | 150ms | Color, border, shadow transitions |
| `--duration-200` | 200ms | Fade in/out |
| `--duration-300` | 300ms | Panel open/close |
| `--ease-in-out` | cubic-bezier(0.4,0,0.2,1) | General transitions |
| `--ease-out` | cubic-bezier(0,0,0.2,1) | Elements entering the screen |
| `--ease-spring` | cubic-bezier(0.34,1.56,0.64,1) | Playful, bouncy actions |

---

## Components

### Button

The primary interactive element. Use it for actions, not navigation.

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `primary` \| `secondary` \| `ghost` \| `danger` | `primary` | Visual style |
| `size` | `sm` \| `md` \| `lg` | `md` | Height: 36 / 44 / 52px |
| `icon` | `IconName` | — | Icon to show inside button |
| `iconPosition` | `leading` \| `trailing` | `leading` | Where the icon appears |
| `loading` | `boolean` | `false` | Shows spinner, keeps button width |
| `disabled` | `boolean` | `false` | Prevents interaction |
| `fullWidth` | `boolean` | `false` | Stretches to container width |
| `children` | `ReactNode` | required | Button label |

**Variants:**

```tsx
// Primary — main action on a page or form. Use once per section.
<Button variant="primary">Save changes</Button>

// Secondary — secondary or cancel action alongside a primary
<Button variant="secondary">Cancel</Button>

// Ghost — low-emphasis action in dense UIs, tables, nav
<Button variant="ghost">View details</Button>

// Danger — destructive, irreversible actions. Always add a confirmation step.
<Button variant="danger">Delete account</Button>
```

**States:**
```tsx
// Async action — button keeps its natural width, spinner replaces label
<Button variant="primary" loading>Saving…</Button>

// Unavailable — pair with a tooltip explaining why
<Button variant="primary" disabled>Submit</Button>
```

**With icon:**
```tsx
<Button variant="primary" icon="plus" iconPosition="leading">Add item</Button>
<Button variant="ghost" icon="arrow-right" iconPosition="trailing">Next step</Button>
```

**Rules:**
- Use `primary` once per section — multiple primaries compete for attention
- `danger` buttons must always require a second confirmation (dialog, "type to confirm", etc.)
- The `loading` prop preserves button width so the UI doesn't shift
- Avoid icon-only buttons without a visible label — add an `aria-label` if you must

---

### Badge

A small inline label that communicates status or category.

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `default` \| `success` \| `warning` \| `error` \| `info` | `default` | Color/meaning |
| `size` | `sm` \| `md` | `md` | |
| `children` | `ReactNode` | required | Badge text |

**Examples:**
```tsx
<Badge variant="default">Draft</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
<Badge variant="info">Beta</Badge>
```

**Rules:**
- Keep badge text short — 1–2 words max
- Don't use badges for actions — use Button
- Use `success` for positive/live states, `error` for blocking problems, `warning` for things needing attention

---

### Icon

Renders any icon from the 50-icon library as an inline SVG. All icons are 24×24 stroke-based.

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `IconName` | required | Icon identifier |
| `size` | `number` | `24` | Width & height in pixels |
| `color` | `string` | `currentColor` | Stroke color |

**Full icon list:** see the Gallery story in Storybook or `src/components/Icon/icons.ts`.

**Examples:**
```tsx
<Icon name="search" size={20} />
<Icon name="user" size={24} color="var(--color-brand)" />
<Icon name="check-circle" size={16} color="var(--color-success)" />
```

**Rules:**
- Use `currentColor` (the default) so icons inherit color from their parent text
- Icons that convey meaning must have a text alternative — either visible label or `aria-label` on the parent
- Icons used for decoration only must have `aria-hidden="true"` (the component does this by default)

---

### Input

Text field for forms. Supports labels, icons, validation states, and password toggle.

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | `sm` \| `md` \| `lg` | `md` | |
| `label` | `string` | — | Visible label above the field |
| `helperText` | `string` | — | Hint shown below the field |
| `errorMessage` | `string` | — | Shown instead of helperText on error |
| `validationState` | `default` \| `error` \| `success` \| `loading` | `default` | Drives border color and trailing icon |
| `leadingIcon` | `IconName` | — | Icon on the left inside the field |
| `trailingIcon` | `IconName` | — | Icon on the right (overridden by validation icons) |
| `prefix` | `string` | — | Fixed text before the input (e.g. `https://`) |
| `suffix` | `string` | — | Fixed text after the input (e.g. `.com`) |
| `disabled` | `boolean` | `false` | |
| `readOnly` | `boolean` | `false` | |
| `required` | `boolean` | `false` | Shows `*` next to label |
| `fullWidth` | `boolean` | `false` | |
| `type` | HTML input type | `text` | `password` activates show/hide toggle |

**Trailing slot priority:** loading spinner → success icon → error icon → password toggle → `trailingIcon` prop

**Examples:**
```tsx
// Basic labeled field
<Input label="Email" placeholder="you@example.com" />

// With validation
<Input
  label="Email"
  validationState="error"
  errorMessage="Please enter a valid email address"
/>

// Search field with icon
<Input placeholder="Search…" leadingIcon="search" />

// Password with built-in show/hide
<Input label="Password" type="password" />

// URL field with prefix
<Input prefix="https://" placeholder="yoursite.com" />
```

**Rules:**
- Always include a `label` or `aria-label` — never use `placeholder` as the only label
- Show `helperText` for format hints *before* the user submits; switch to `errorMessage` after validation fails
- The `required` prop adds `aria-required` and shows a `*` — also validate server-side

---

### Select

Custom dropdown for choosing from a list of options. Fully keyboard accessible (arrows, Home, End, Enter, Escape).

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `SelectOption[]` | required | `{ value, label, disabled? }` |
| `value` | `string` | — | Controlled value |
| `defaultValue` | `string` | — | Uncontrolled initial value |
| `onChange` | `(value: string) => void` | — | Called when selection changes |
| `placeholder` | `string` | `Select…` | Shown when nothing is selected |
| `size` | `sm` \| `md` \| `lg` | `md` | |
| `label` | `string` | — | |
| `helperText` | `string` | — | |
| `errorMessage` | `string` | — | |
| `validationState` | `default` \| `error` \| `success` \| `loading` | `default` | |
| `leadingIcon` | `IconName` | — | |
| `disabled` | `boolean` | `false` | |
| `required` | `boolean` | `false` | |
| `fullWidth` | `boolean` | `false` | |
| `name` | `string` | — | For HTML form submission |

**Controlled example:**
```tsx
const [country, setCountry] = useState('');

<Select
  label="Country"
  options={[
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
  ]}
  value={country}
  onChange={setCountry}
  placeholder="Select country…"
/>
```

**Uncontrolled (inside a form):**
```tsx
<Select
  label="Role"
  name="role"
  options={roleOptions}
  defaultValue="viewer"
/>
```

---

## Layout patterns

### Form layout

Stack fields vertically with `--space-5` (20px) gap. Group related fields horizontally only on wider screens.

```tsx
<form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: '480px' }}>
  <Input label="Full name" placeholder="Jane Smith" required />
  <Input label="Email" type="email" placeholder="jane@example.com" required />
  <Select label="Role" options={roleOptions} />
  <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary" type="submit">Save</Button>
  </div>
</form>
```

### Status row

Use badges next to headings or table rows to show live state:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
  <span style={{ fontWeight: 'var(--weight-semibold)' }}>Payment</span>
  <Badge variant="success">Processed</Badge>
</div>
```

### Action bar

Put the primary action on the right, secondary on the left:

```tsx
<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
  <Button variant="ghost">Discard</Button>
  <Button variant="secondary">Save draft</Button>
  <Button variant="primary">Publish</Button>
</div>
```

---

## Dark mode

Dark mode is driven entirely by CSS tokens — no component code changes are needed.

To switch modes:
```ts
// Enable dark mode
document.documentElement.classList.add('dark');

// Disable dark mode
document.documentElement.classList.remove('dark');

// Toggle
document.documentElement.classList.toggle('dark');
```

All semantic color tokens (`--color-*`) redefine themselves under the `.dark` class. Primitive tokens (`--blue-*`, `--neutral-*`) do not change.

**Rules:**
- Never hardcode hex values in component styles — always use semantic tokens
- Never use primitive tokens directly in component code — they don't respond to dark mode

---

## Accessibility rules

These rules apply to all pages and components built with this system:

1. **All interactive elements must be reachable by keyboard.** Tab to focus, Enter/Space to activate, Escape to dismiss overlays.

2. **Focus states must be visible.** All components show a focus ring via `box-shadow: var(--shadow-brand)` on `:focus-visible`. Never remove this.

3. **All form fields must have a label.** Use the `label` prop on Input/Select, or provide an `aria-label` attribute.

4. **Icons that convey meaning need a text alternative.** Either a visible sibling label or `aria-label` on the icon's container.

5. **Error messages must be programmatically associated.** Input and Select use `aria-describedby` pointing to the helper text — this works automatically when you use the `errorMessage` prop.

6. **Disabled controls need context.** Pair `disabled` buttons with a tooltip explaining why the action is unavailable.

7. **Color is not the only signal.** Validation states use both color and an icon (check, error triangle) so colorblind users can distinguish them.

8. **Sufficient color contrast.** `--color-text-primary` on `--color-bg-surface` passes WCAG AA in both light and dark modes.

---

## Figma connection

This system is connected to the **Copycat-DS** Figma file via Code Connect.

- `.figma.tsx` files in each component folder define the mapping between Figma properties and React props
- Publishing: `npm run cc:publish` (requires `FIGMA_TOKEN` in `.env`)
- The Figma plugin in `figma-plugin/` can regenerate component sets from the JSON schemas in `components/`

When a designer delivers a Figma frame, you can use Figma's Dev Mode to get the Code Connect snippet — it will show the exact React component with props already filled in.
