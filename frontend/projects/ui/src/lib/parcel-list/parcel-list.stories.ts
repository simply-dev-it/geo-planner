import type { Meta, StoryObj } from '@storybook/angular';
import { ParcelList } from './parcel-list';
const meta: Meta<ParcelList> = {
  title: 'UI/Parcel list',
  component: ParcelList,
  tags: ['autodocs'],
  args: { rows: [{ id: 'one', label: '101/1', context: 'Brzozowo · obręb Centrum' }] },
};
export default meta;
type Story = StoryObj<ParcelList>;
export const Selected: Story = {};
export const Suggestions: Story = { args: { action: 'Dodaj', label: 'Proponowane działki' } };
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { rows: [] } };

export const ReadOnly: Story = { args: { readOnly: true } };
