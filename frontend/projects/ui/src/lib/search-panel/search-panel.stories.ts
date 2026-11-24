import type { Meta, StoryObj } from '@storybook/angular';
import { SearchPanel } from './search-panel';
const meta: Meta<SearchPanel> = {
  title: 'UI/Search panel',
  component: SearchPanel,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    template: `<div style="width:340px;height:540px;display:flex;flex-direction:column;padding:16px;background:white"><gp-search-panel [stage]="stage" [localityLabel]="localityLabel" [streetLabel]="streetLabel" [rows]="rows" [loading]="loading" [error]="error" [hasMore]="hasMore" [initial]="initial" [submitted]="submitted" [contextPrompt]="contextPrompt" /></div>`,
  }),
  args: {
    stage: 'locality',
    rows: [],
    loading: false,
    error: null,
    hasMore: false,
    submitted: false,
    contextPrompt: null,
    initial: { query: '', regionId: '', type: 'locality' },
    localityLabel: null,
    streetLabel: null,
  },
};
export default meta;
type Story = StoryObj<SearchPanel>;
export const Locality: Story = {};
export const Street: Story = {
  args: {
    stage: 'street',
    localityLabel: 'Brzozowo',
    initial: { query: 'Lip', regionId: '', type: 'street' },
  },
};
export const NumberChoice: Story = {
  args: { stage: 'number', localityLabel: 'Brzozowo', streetLabel: 'Lipowa' },
};
export const HouseNumber: Story = {
  args: {
    stage: 'house',
    localityLabel: 'Brzozowo',
    streetLabel: 'Lipowa',
    initial: { query: '1', regionId: '', type: 'address' },
  },
};
export const ShortParcel: Story = {
  args: {
    stage: 'parcel',
    localityLabel: 'Brzozowo',
    initial: { query: '101/1', regionId: '', type: 'parcel' },
  },
};
export const FullIdentity: Story = {
  args: {
    stage: 'identifier',
    initial: { query: '999999_9.9999.1', regionId: '', type: 'parcel' },
  },
};
export const Loading: Story = { args: { loading: true, submitted: true } };
export const Failed: Story = { args: { error: 'Wyszukiwanie jest niedostępne.', submitted: true } };
export const NoMatches: Story = { args: { submitted: true } };
export const NeedsContext: Story = {
  args: {
    ...ShortParcel.args,
    contextPrompt: 'Przybliż mapę do szukanej okolicy.',
    submitted: true,
  },
};
export const Results: Story = {
  args: {
    ...Street.args,
    rows: [{ id: 'street', label: 'Lipowa', context: 'Brzozowo', kind: 'Ulica' }],
    submitted: true,
    hasMore: true,
  },
};
