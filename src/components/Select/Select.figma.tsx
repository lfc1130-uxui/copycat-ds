import figma from '@figma/code-connect';
import { Select } from './Select';

// -------------------------------------------------------------------
// HOW TO GET THE NODE ID
// 1. Open Copycat-DS in Figma
// 2. Right-click the "Select" component set → Copy link
// 3. URL looks like: https://figma.com/design/Bx2SZ05iUtuDw4xWoDMjJs/...?node-id=123-456
// 4. Replace NODE_ID below with that value (e.g. "123-456")
// -------------------------------------------------------------------
const FIGMA_URL = 'https://www.figma.com/design/Bx2SZ05iUtuDw4xWoDMjJs?node-id=NODE_ID';

figma.connect(Select, FIGMA_URL, {
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
    }),
    validationState: figma.enum('State', {
      Default:  'default',
      Focus:    'default',
      Error:    'error',
      Success:  'success',
      Loading:  'loading',
      Disabled: 'default',
    }),
    leadingIcon: figma.enum('Icon', {
      None:    undefined,
      Leading: 'search',
    }),
    // Value=Empty → no defaultValue; Value=Filled → show selected option
    placeholder: figma.string('Placeholder'),
    label:       figma.string('Label'),
  },

  example: ({ size, disabled, validationState, leadingIcon, placeholder, label }) => (
    <Select
      size={size}
      label={label}
      placeholder={placeholder}
      validationState={validationState}
      leadingIcon={leadingIcon}
      disabled={disabled}
      options={[
        { value: 'option-1', label: 'Option 1' },
        { value: 'option-2', label: 'Option 2' },
        { value: 'option-3', label: 'Option 3' },
      ]}
    />
  ),
});

// ── Usage examples ────────────────────────────────────────────────────────────
//
// Default
// <Select label="Country" placeholder="Select a country" options={countryOptions} />
//
// Controlled
// <Select label="Currency" value={currency} onChange={setCurrency} options={currencyOptions} />
//
// Sizes
// <Select size="sm" placeholder="Filter by…" options={options} />
// <Select size="lg" label="Account" options={accountOptions} />
//
// With leading icon
// <Select leadingIcon="globe" label="Region" options={regionOptions} />
//
// Validation states
// <Select validationState="error" label="Plan" errorMessage="Please select a plan." options={options} />
// <Select validationState="success" label="Role" helperText="Role confirmed." options={options} />
//
// Disabled / full width
// <Select disabled label="Subscription" value="pro" options={options} />
// <Select fullWidth label="Category" options={categoryOptions} />
