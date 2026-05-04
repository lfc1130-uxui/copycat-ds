import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    variant:      { control: 'select',  options: ['primary', 'secondary', 'ghost', 'danger'] },
    size:         { control: 'select',  options: ['sm', 'md', 'lg'] },
    icon:         { control: 'select',  options: [undefined, 'search', 'plus', 'download', 'upload', 'trash', 'edit', 'arrow-right', 'arrow-left', 'user', 'lock'] },
    iconPosition: { control: 'radio',   options: ['leading', 'trailing'] },
    loading:      { control: 'boolean' },
    disabled:     { control: 'boolean' },
    fullWidth:    { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', size: 'md', children: 'Save changes' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', size: 'md', children: 'Cancel' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', size: 'md', children: 'View details' },
};

export const Danger: Story = {
  args: { variant: 'danger', size: 'md', children: 'Delete account' },
};

export const WithLeadingIcon: Story = {
  args: { variant: 'primary', size: 'md', icon: 'plus', iconPosition: 'leading', children: 'Add item' },
};

export const WithTrailingIcon: Story = {
  args: { variant: 'primary', size: 'md', icon: 'arrow-right', iconPosition: 'trailing', children: 'Continue' },
};

export const Loading: Story = {
  args: { variant: 'primary', size: 'md', loading: true, children: 'Saving…' },
};

export const Disabled: Story = {
  args: { variant: 'primary', size: 'md', disabled: true, children: 'Save changes' },
};

export const FullWidth: Story = {
  args: { variant: 'primary', size: 'lg', fullWidth: true, children: 'Create account' },
  parameters: { layout: 'padded' },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <Button variant="primary" size="sm">Small</Button>
      <Button variant="primary" size="md">Medium</Button>
      <Button variant="primary" size="lg">Large</Button>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <Button variant="primary">Default</Button>
      <Button variant="primary" loading>Loading</Button>
      <Button variant="primary" disabled>Disabled</Button>
    </div>
  ),
};
