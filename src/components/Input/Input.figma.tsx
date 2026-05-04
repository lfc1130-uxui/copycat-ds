import figma from '@figma/code-connect';
import { Input } from './Input';

// -------------------------------------------------------------------
// HOW TO GET THE NODE ID
// 1. Open Copycat-DS in Figma
// 2. Right-click the "Input" component set → Copy link
// 3. URL looks like: https://figma.com/design/Bx2SZ05iUtuDw4xWoDMjJs/...?node-id=123-456
// 4. Replace NODE_ID below with that value (e.g. "123-456")
// -------------------------------------------------------------------
const FIGMA_URL = 'https://www.figma.com/design/Bx2SZ05iUtuDw4xWoDMjJs?node-id=NODE_ID';

figma.connect(Input, FIGMA_URL, {
  props: {
    size: figma.enum('Size', {
      SM: 'sm',
      MD: 'md',
      LG: 'lg',
    }),
    disabled: figma.enum('State', {
      Default:  false,
      Focus:    false,
      Error:    false,
      Success:  false,
      Loading:  false,
      Disabled: true,
      ReadOnly: false,
    }),
    readOnly: figma.enum('State', {
      Default:  false,
      Focus:    false,
      Error:    false,
      Success:  false,
      Loading:  false,
      Disabled: false,
      ReadOnly: true,
    }),
    validationState: figma.enum('State', {
      Default:  'default',
      Focus:    'default',
      Error:    'error',
      Success:  'success',
      Loading:  'loading',
      Disabled: 'default',
      ReadOnly: 'default',
    }),
    leadingIcon: figma.enum('Icon', {
      None:    undefined,
      Leading: 'search',
    }),
    required: figma.enum('Required', {
      False: false,
      True:  true,
    }),
    label:       figma.string('Label'),
    placeholder: figma.string('Placeholder'),
  },

  example: ({ size, disabled, readOnly, validationState, leadingIcon, required, label, placeholder }) => (
    <Input
      size={size}
      label={label}
      placeholder={placeholder}
      validationState={validationState}
      leadingIcon={leadingIcon}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
    />
  ),
});

// ── Usage examples ────────────────────────────────────────────────────────────
//
// Default
// <Input label="Email" placeholder="name@example.com" />
//
// Sizes
// <Input size="sm" label="Search" placeholder="Search…" leadingIcon="search" />
// <Input size="lg" label="Password" type="password" />
//
// Validation states
// <Input validationState="error" label="Email" errorMessage="Please enter a valid email." />
// <Input validationState="success" label="Username" helperText="Username is available." />
// <Input validationState="loading" label="Checking…" />
//
// Disabled / ReadOnly
// <Input disabled label="Account ID" value="ACC-00482" />
// <Input readOnly label="Reference" value="REF-20240315" />
//
// Full width — forms, modals
// <Input fullWidth label="Full name" placeholder="Jane Smith" required />
//
// With prefix / suffix
// <Input prefix="$" label="Amount" placeholder="0.00" />
// <Input suffix="kg" label="Weight" />
