import figma from '@figma/code-connect';
import { Badge } from './Badge';

// -------------------------------------------------------------------
// HOW TO GET THE NODE ID
// 1. Open your Figma file
// 2. Right-click the "Badge" component set → Copy link
// 3. The URL looks like:
//    https://www.figma.com/design/Bx2SZ05iUtuDw4xWoDMjJs/...?node-id=123-456
// 4. Replace NODE_ID below with that node-id value (e.g. "123-456")
// -------------------------------------------------------------------
const FIGMA_URL = 'https://www.figma.com/design/Bx2SZ05iUtuDw4xWoDMjJs/Copycat-DS?node-id=148-3283&t=hxjPzywil4aeQlmi-1';

// ── Primary usage ────────────────────────────────────────────────────────────
figma.connect(Badge, FIGMA_URL, {
  props: {
    variant: figma.enum('Variant', {
      Default: 'default',
      Success: 'success',
      Warning: 'warning',
      Error:   'error',
      Info:    'info',
    }),
    size: figma.enum('Size', {
      SM: 'sm',
      MD: 'md',
    }),S
    // Maps the Figma text layer named "Label" → React children
    children: figma.string('Label'),
  },

  example: ({ variant, size, children }) => (
    <Badge variant={variant} size={size}>
      {children}
    </Badge>
  ),
});

// ── Realistic variant examples ────────────────────────────────────────────────
//
// Default — neutral, no semantic meaning
// <Badge variant="default">Draft</Badge>
// <Badge variant="default">v2.1.0</Badge>
//
// Success — positive, completed, live
// <Badge variant="success">Active</Badge>
// <Badge variant="success">Verified</Badge>
// <Badge variant="success">Completed</Badge>
//
// Warning — needs attention, expiring, pending review
// <Badge variant="warning">Pending</Badge>
// <Badge variant="warning">Expiring soon</Badge>
// <Badge variant="warning">Review needed</Badge>
//
// Error — failed, blocked, rejected
// <Badge variant="error">Failed</Badge>
// <Badge variant="error">Rejected</Badge>
// <Badge variant="error">Overdue</Badge>
//
// Info — feature flags, release status, contextual tags
// <Badge variant="info">Beta</Badge>
// <Badge variant="info">New</Badge>
// <Badge variant="info">Preview</Badge>
//
// Small — tight spaces, table cells, inline next to text
// <Badge variant="success" size="sm">Active</Badge>
// <Badge variant="error"   size="sm">Failed</Badge>
