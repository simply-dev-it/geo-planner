import type { Meta, StoryObj } from '@storybook/angular';
import { MapTools } from './map-tools';
const meta: Meta<MapTools> = { title: 'UI/Map tools', component: MapTools, tags: ['autodocs'] };
export default meta;
type Story = StoryObj<MapTools>;
export const Empty: Story = {};
export const AreaSelected: Story = { args: { hasArea: true } };
export const Drawing: Story = { args: { drawing: true } };
export const Disabled: Story = { args: { disabled: true, hasArea: true } };
