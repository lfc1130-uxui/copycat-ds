import type { Meta, StoryObj } from '@storybook/react';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { icons } from './icons';

const iconNames = Object.keys(icons) as IconName[];

const meta: Meta<typeof Icon> = {
  title: 'Components/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    name:  { control: 'select', options: iconNames },
    size:  { control: 'number', min: 12, max: 48, step: 2 },
    color: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {
  args: { name: 'search', size: 24 },
};

export const Large: Story = {
  args: { name: 'user', size: 48 },
};

export const Small: Story = {
  args: { name: 'check', size: 16 },
};

export const Gallery: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', maxWidth: '640px' }}>
      {iconNames.map(name => (
        <div
          key={name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            width: '72px',
          }}
        >
          <Icon name={name} size={24} />
          <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textAlign: 'center', wordBreak: 'break-all' }}>
            {name}
          </span>
        </div>
      ))}
    </div>
  ),
  parameters: { layout: 'padded' },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
      {([12, 16, 20, 24, 32, 48] as const).map(size => (
        <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <Icon name="star" size={size} />
          <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{size}px</span>
        </div>
      ))}
    </div>
  ),
};
