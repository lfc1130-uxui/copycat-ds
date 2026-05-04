import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';

const COUNTRY_OPTIONS = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'jp', label: 'Japan', disabled: true },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    size:            { control: 'select', options: ['sm', 'md', 'lg'] },
    validationState: { control: 'select', options: ['default', 'error', 'success', 'loading'] },
    leadingIcon:     { control: 'select', options: [undefined, 'search', 'user', 'globe', 'lock'] },
    disabled:        { control: 'boolean' },
    required:        { control: 'boolean' },
    fullWidth:       { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: { options: COUNTRY_OPTIONS, placeholder: 'Select country…', size: 'md' },
};

export const WithLabel: Story = {
  args: { options: COUNTRY_OPTIONS, label: 'Country', placeholder: 'Select country…', size: 'md' },
};

export const WithHelperText: Story = {
  args: {
    options: COUNTRY_OPTIONS,
    label: 'Country',
    placeholder: 'Select country…',
    helperText: 'Used for shipping address',
    size: 'md',
  },
};

export const ErrorState: Story = {
  args: {
    options: COUNTRY_OPTIONS,
    label: 'Country',
    placeholder: 'Select country…',
    validationState: 'error',
    errorMessage: 'Please select a country to continue',
    size: 'md',
  },
};

export const SuccessState: Story = {
  args: {
    options: COUNTRY_OPTIONS,
    label: 'Country',
    value: 'us',
    validationState: 'success',
    helperText: 'Great choice!',
    size: 'md',
  },
};

export const WithLeadingIcon: Story = {
  args: {
    options: ROLE_OPTIONS,
    label: 'Role',
    leadingIcon: 'user',
    placeholder: 'Select role…',
    size: 'md',
  },
};

export const Disabled: Story = {
  args: { options: COUNTRY_OPTIONS, label: 'Country', value: 'us', disabled: true, size: 'md' },
};

export const Required: Story = {
  args: { options: COUNTRY_OPTIONS, label: 'Country', placeholder: 'Select country…', required: true, size: 'md' },
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '320px' }}>
      <Select options={COUNTRY_OPTIONS} placeholder="Small" size="sm" />
      <Select options={COUNTRY_OPTIONS} placeholder="Medium" size="md" />
      <Select options={COUNTRY_OPTIONS} placeholder="Large" size="lg" />
    </div>
  ),
  parameters: { layout: 'padded' },
};
