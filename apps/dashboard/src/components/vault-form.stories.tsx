import type { Meta, StoryObj } from '@storybook/react';
import { VaultForm } from './vault-form';

const meta: Meta<typeof VaultForm> = {
  title: 'Components/VaultForm',
  component: VaultForm,
  tags: ['autodocs'],
  argTypes: {
    onCreate: { action: 'created' },
    isActive: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof VaultForm>;

/**
 * Default VaultForm state
 */
export const Default: Story = {
  args: {
    isActive: false,
  },
};

/**
 * VaultForm with active vault
 */
export const ActiveVault: Story = {
  args: {
    isActive: true,
  },
};

/**
 * VaultForm with creating state
 */
export const Creating: Story = {
  args: {
    isActive: false,
  },
};