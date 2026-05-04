import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    size:            { control: 'select', options: ['sm', 'md', 'lg'] },
    validationState: { control: 'select', options: ['default', 'error', 'success', 'loading'] },
    leadingIcon:     { control: 'select', options: [undefined, 'search', 'user', 'lock', 'mail', 'phone', 'link'] },
    trailingIcon:    { control: 'select', options: [undefined, 'search', 'close', 'eye', 'eye-off'] },
    disabled:        { control: 'boolean' },
    readOnly:        { control: 'boolean' },
    required:        { control: 'boolean' },
    fullWidth:       { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text…', size: 'md' },
};

export const WithLabel: Story = {
  args: { label: 'Email address', placeholder: 'you@example.com', size: 'md' },
};

export const WithHelperText: Story = {
  args: { label: 'Username', placeholder: 'johndoe', helperText: 'Must be 3–20 characters, letters and numbers only', size: 'md' },
};

export const ErrorState: Story = {
  args: {
    label: 'Email',
    placeholder: 'you@example.com',
    validationState: 'error',
    errorMessage: 'Please enter a valid email address',
    size: 'md',
  },
};

export const SuccessState: Story = {
  args: {
    label: 'Email',
    defaultValue: 'you@example.com',
    validationState: 'success',
    helperText: 'Email verified',
    size: 'md',
  },
};

export const LoadingState: Story = {
  args: { label: 'Username', defaultValue: 'johndoe', validationState: 'loading', size: 'md' },
};

export const WithLeadingIcon: Story = {
  args: { placeholder: 'Search…', leadingIcon: 'search', size: 'md' },
};

export const Password: Story = {
  args: { label: 'Password', type: 'password', placeholder: 'Enter your password', size: 'md' },
};

export const WithPrefix: Story = {
  args: { prefix: 'https://', placeholder: 'yoursite.com', size: 'md' },
};

export const WithSuffix: Story = {
  args: { suffix: '.com', placeholder: 'yoursite', size: 'md' },
};

export const Disabled: Story = {
  args: { label: 'Email', defaultValue: 'you@example.com', disabled: true, size: 'md' },
};

export const ReadOnly: Story = {
  args: { label: 'API Key', defaultValue: 'sk-abc123def456', readOnly: true, size: 'md' },
};

export const Required: Story = {
  args: { label: 'Email', placeholder: 'you@example.com', required: true, size: 'md' },
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '320px' }}>
      <Input placeholder="Small" size="sm" />
      <Input placeholder="Medium" size="md" />
      <Input placeholder="Large" size="lg" />
    </div>
  ),
  parameters: { layout: 'padded' },
};
