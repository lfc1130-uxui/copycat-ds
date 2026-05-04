import { useState } from 'react'
import { Button } from '../../src/components/Button'
import { Icon } from '../../src/components/Icon'
import type { IconName } from '../../src/components/Icon'
import { Badge }  from '../../src/components/Badge'
import { Input } from '../../src/components/Input'
import { Select } from '../../src/components/Select'
import './App.css'

// Simulates the old disabled style (opacity-based)
const BEFORE: React.CSSProperties = { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' }

const ACCOUNT_OPTIONS  = [
  { value: 'current',  label: 'Current account — ••4582' },
  { value: 'savings',  label: 'Savings account — ••1293' },
  { value: 'isa',      label: 'Cash ISA — ••8801' },
  { value: 'business', label: 'Business account — ••3370' },
]

const COUNTRY_OPTIONS  = [
  { value: 'gb', label: 'United Kingdom' },
  { value: 'us', label: 'United States'  },
  { value: 'de', label: 'Germany'        },
  { value: 'fr', label: 'France'         },
  { value: 'es', label: 'Spain'          },
]

const CURRENCY_OPTIONS = [
  { value: 'gbp', label: 'GBP — British Pound'  },
  { value: 'usd', label: 'USD — US Dollar'       },
  { value: 'eur', label: 'EUR — Euro'            },
  { value: 'jpy', label: 'JPY — Japanese Yen'   },
]

const ICON_GROUPS: { label: string; icons: IconName[] }[] = [
  { label: 'Navigation',     icons: ['home', 'menu', 'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'arrow-left', 'arrow-right', 'external-link'] },
  { label: 'Actions',        icons: ['search', 'plus', 'minus', 'close', 'check', 'edit', 'trash', 'copy', 'share', 'download', 'upload', 'refresh'] },
  { label: 'User & Auth',    icons: ['user', 'users', 'lock', 'unlock', 'eye', 'eye-off'] },
  { label: 'Feedback',       icons: ['info', 'warning', 'error', 'check-circle', 'bell', 'question'] },
  { label: 'Content',        icons: ['star', 'heart', 'bookmark', 'tag', 'filter', 'sort'] },
  { label: 'Media',          icons: ['image', 'camera', 'play', 'pause'] },
  { label: 'Files',          icons: ['file', 'folder', 'link'] },
  { label: 'Communication',  icons: ['mail', 'message', 'phone'] },
  { label: 'Layout',         icons: ['grid', 'list', 'more-horizontal', 'more-vertical'] },
  { label: 'Misc',           icons: ['calendar', 'clock', 'globe', 'settings'] },
]

function App() {
  const [dark, setDark] = useState(false)

  return (
    <div className={dark ? 'dark' : ''} style={{ minHeight: '100vh', background: 'var(--color-bg-page)', color: 'var(--color-text-primary)' }}>
      <div className="playground">

        {/* Header */}
        <div className="playground-header">
          <h1 className="playground-title">Component Playground</h1>
          <Button variant="ghost" size="sm" onClick={() => setDark(d => !d)}>
            {dark ? 'Light mode' : 'Dark mode'}
          </Button>
        </div>

        {/* ── BUTTON ── */}
        <section className="section">
          <h2 className="section-title">Button</h2>

          <div className="row-label">Variants</div>
          <div className="row">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>

          <div className="row-label">Sizes</div>
          <div className="row">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>

          <div className="row-label">Icons</div>
          <div className="row">
            <Button variant="primary"   icon="search">Search</Button>
            <Button variant="primary"   icon="download" iconPosition="trailing">Download</Button>
            <Button variant="secondary" icon="plus">Add item</Button>
            <Button variant="ghost"     icon="settings">Settings</Button>
            <Button variant="danger"    icon="trash">Delete</Button>
          </div>

          <div className="row-label">Loading</div>
          <div className="row">
            <Button variant="primary"   loading>Primary</Button>
            <Button variant="secondary" loading>Secondary</Button>
            <Button variant="ghost"     loading>Ghost</Button>
            <Button variant="danger"    loading>Danger</Button>
          </div>

          <div className="row-label">States</div>
          <div className="row">
            <Button variant="primary">Default</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="secondary" disabled>Disabled</Button>
            <Button variant="ghost" disabled>Disabled</Button>
            <Button variant="danger" disabled>Disabled</Button>
          </div>

          <div className="row-label">Disabled — Before (opacity-based)</div>
          <div className="row">
            <Button variant="primary"   style={BEFORE}>Primary</Button>
            <Button variant="secondary" style={BEFORE}>Secondary</Button>
            <Button variant="ghost"     style={BEFORE}>Ghost</Button>
            <Button variant="danger"    style={BEFORE}>Danger</Button>
          </div>

          <div className="row-label">Disabled — After (neutral gray)</div>
          <div className="row">
            <Button variant="primary"   disabled>Primary</Button>
            <Button variant="secondary" disabled>Secondary</Button>
            <Button variant="ghost"     disabled>Ghost</Button>
            <Button variant="danger"    disabled>Danger</Button>
          </div>
        </section>

        {/* ── ICONS ── */}
        <section className="section">
          <h2 className="section-title">Icons</h2>
          {ICON_GROUPS.map(group => (
            <div key={group.label}>
              <div className="row-label">{group.label}</div>
              <div className="icon-grid">
                {group.icons.map(name => (
                  <div key={name} className="icon-item">
                    <Icon name={name} size={20} />
                    <span className="icon-name">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ── BADGE ── */}
        <section className="section">
          <h2 className="section-title">Badge</h2>

          <div className="row-label">Variants</div>
          <div className="row">
            <Badge variant="default">Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
          </div>

          <div className="row-label">Sizes</div>
          <div className="row">
            <Badge variant="success" size="sm">Small</Badge>
            <Badge variant="success" size="md">Medium</Badge>
          </div>
        </section>

        {/* ── INPUT ── */}
        <section className="section">
          <h2 className="section-title">Input</h2>

          <div className="row-label">Sizes</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Input size="sm" label="Small" placeholder="Placeholder" />
            <Input size="md" label="Medium" placeholder="Placeholder" />
            <Input size="lg" label="Large" placeholder="Placeholder" />
          </div>

          <div className="row-label">Validation states</div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Input label="Default" placeholder="Account number" helperText="Enter your 10-digit account number" />
            <Input label="Error" placeholder="Account number" validationState="error" errorMessage="Account number not found" defaultValue="1234" />
            <Input label="Success" placeholder="Account number" validationState="success" helperText="Account verified" defaultValue="9876543210" />
            <Input label="Loading" placeholder="Verifying…" validationState="loading" helperText="Checking account…" defaultValue="9876543210" />
          </div>

          <div className="row-label">Icons</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Input label="Search" placeholder="Search transactions" leadingIcon="search" />
            <Input label="Amount" placeholder="0.00" prefix="$" suffix="USD" />
            <Input label="Phone" placeholder="+1 (555) 000-0000" leadingIcon="phone" type="tel" />
          </div>

          <div className="row-label">Password</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Input label="Password" placeholder="Enter password" type="password" helperText="At least 8 characters" />
            <Input label="Password — error" placeholder="Enter password" type="password" validationState="error" errorMessage="Incorrect password" defaultValue="hunter2" />
          </div>

          <div className="row-label">Disabled & Read-only</div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Input label="Disabled" placeholder="Not available" disabled />
            <Input label="Disabled with value" defaultValue="ACC-00129834" disabled />
            <Input label="Read-only" defaultValue="ACC-00129834" readOnly helperText="Contact support to change" />
          </div>

          <div className="row-label">Required</div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Input label="Full name" placeholder="Jane Doe" required />
            <Input label="Sort code" placeholder="00-00-00" required leadingIcon="lock" helperText="6-digit sort code" />
          </div>
        </section>

        {/* ── SELECT ── */}
        <section className="section">
          <h2 className="section-title">Select</h2>

          <div className="row-label">Sizes</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Select size="sm" label="Small"  placeholder="Choose…" options={ACCOUNT_OPTIONS} />
            <Select size="md" label="Medium" placeholder="Choose…" options={ACCOUNT_OPTIONS} />
            <Select size="lg" label="Large"  placeholder="Choose…" options={ACCOUNT_OPTIONS} />
          </div>

          <div className="row-label">Validation states</div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Select label="Default"  placeholder="Select account" options={ACCOUNT_OPTIONS} helperText="Choose an account to continue" />
            <Select label="Error"    options={ACCOUNT_OPTIONS} validationState="error"   errorMessage="Please select an account" defaultValue="" />
            <Select label="Success"  options={ACCOUNT_OPTIONS} validationState="success" helperText="Account verified"            defaultValue="current" />
            <Select label="Loading"  options={ACCOUNT_OPTIONS} validationState="loading" helperText="Verifying account…"          defaultValue="current" />
          </div>

          <div className="row-label">Leading icon</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Select label="Account type" placeholder="Select type"     leadingIcon="grid"     options={ACCOUNT_OPTIONS} />
            <Select label="Country"      placeholder="Select country"  leadingIcon="globe"    options={COUNTRY_OPTIONS} />
            <Select label="Currency"     placeholder="Select currency" leadingIcon="settings" options={CURRENCY_OPTIONS} />
          </div>

          <div className="row-label">Disabled & Required</div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Select label="Disabled"          options={ACCOUNT_OPTIONS} disabled placeholder="Not available" />
            <Select label="Disabled with value" options={ACCOUNT_OPTIONS} disabled defaultValue="current" />
            <Select label="Account type" placeholder="Select type" options={ACCOUNT_OPTIONS} required helperText="Required to proceed" />
          </div>
        </section>

      </div>
    </div>
  )
}

export default App
