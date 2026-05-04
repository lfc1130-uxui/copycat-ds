import figma from '@figma/code-connect';
import { Button } from './Button';

// -------------------------------------------------------------------
// HOW TO GET THE NODE ID
// 1. Open your Figma file
// 2. Right-click the "Button" component set → Copy link
// 3. The URL looks like:
//    https://www.figma.com/design/Bx2SZ05iUtuDw4xWoDMjJs/...?node-id=123-456
// 4. Replace NODE_ID below with that node-id value (e.g. "123-456")
// -------------------------------------------------------------------
const FIGMA_URL = 'https://www.figma.com/design/Bx2SZ05iUtuDw4xWoDMjJs/Copycat-DS?node-id=172-24881&t=hxjPzywil4aeQlmi-1';

figma.connect(Button, FIGMA_URL, {
  props: {
    variant: figma.enum('Variant', {
      Primary:   'primary',
      Secondary: 'secondary',
      Ghost:     'ghost',
      Danger:    'danger',
    }),
    size: figma.enum('Size', {
      SM: 'sm',
      MD: 'md',
      LG: 'lg',
    }),
    // State=Disabled → disabled prop; State=Loading → loading prop
    disabled: figma.enum('State', {
      Default:  false,
      Hover:    false,
      Pressed:  false,
      Disabled: true,
      Focus:    false,
      Loading:  false,
    }),
    loading: figma.enum('State', {
      Default:  false,
      Hover:    false,
      Pressed:  false,
      Disabled: false,
      Focus:    false,
      Loading:  true,
    }),
    // Icon=None → no prop; Leading/Trailing → icon prop
    icon: figma.enum('Icon', {
      None:     undefined,
      Leading:  'leading',
      Trailing: 'trailing',
    }),
    children: figma.string('Button'),
  },

  example: ({ variant, size, disabled, loading, icon, children }) => (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      loading={loading}
      icon={icon}
    >
      {children}
    </Button>
  ),
});

// ── Usage examples ────────────────────────────────────────────────────────────
//
// Default
// <Button variant="primary" size="md">Save changes</Button>
// <Button variant="secondary" size="md">Cancel</Button>
// <Button variant="ghost" size="sm">View details</Button>
// <Button variant="danger" size="md">Delete account</Button>
//
// With leading icon — action buttons, forms
// <Button variant="primary" size="md" icon="leading">Add item</Button>
// <Button variant="secondary" size="md" icon="leading">Upload file</Button>
//
// With trailing icon — navigation, next steps
// <Button variant="primary" size="md" icon="trailing">Continue</Button>
// <Button variant="ghost" size="sm" icon="trailing">View all</Button>
//
// Loading — async actions; button keeps its natural width
// <Button variant="primary" size="md" loading>Save changes</Button>
// <Button variant="danger" size="md" loading>Deleting…</Button>
//
// Disabled — unavailable action, pair with a tooltip explaining why
// <Button variant="primary" size="md" disabled>Processing…</Button>
//
// Full width — forms, modals, mobile CTAs
// <Button variant="primary" size="lg" fullWidth>Create account</Button>
