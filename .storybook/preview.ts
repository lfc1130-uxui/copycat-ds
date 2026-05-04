import type { Preview } from '@storybook/react';
import '../src/styles/tokens.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f8f9fc' },
        { name: 'dark', value: '#090b14' },
        { name: 'white', value: '#ffffff' },
      ],
    },
  },
};

export default preview;
