import type { Meta, StoryObj } from '@storybook/angular';

import { PageFrame } from './page-frame';

const meta: Meta<PageFrame> = {
  title: 'UI/Page frame',
  component: PageFrame,
  tags: ['autodocs'],
  args: {
    applicationName: 'Geo Planner',
    contextLabel: 'Przestrzeń projektowa',
  },
  render: (args) => ({
    props: args,
    template: `
      <gp-page-frame
        [applicationName]="applicationName"
        [contextLabel]="contextLabel"
      >
        <h1>Przestrzeń robocza</h1>
        <p>Przykładowa treść osadzona w dostępnej ramie strony.</p>
      </gp-page-frame>
    `,
  }),
};

export default meta;
type Story = StoryObj<PageFrame>;

export const Default: Story = {};

export const WithoutContextLabel: Story = {
  args: {
    contextLabel: undefined,
  },
};
