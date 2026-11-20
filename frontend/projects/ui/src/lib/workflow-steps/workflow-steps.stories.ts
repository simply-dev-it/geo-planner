import type { Meta, StoryObj } from '@storybook/angular';
import { WorkflowSteps } from './workflow-steps';
const meta: Meta<WorkflowSteps> = {
  title: 'UI/Workflow steps',
  component: WorkflowSteps,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<WorkflowSteps>;
export const Search: Story = {};
export const Area: Story = { args: { step: 1 } };
export const Preview: Story = { args: { step: 2 } };
export const Saving: Story = { args: { step: 2, disabled: true } };
