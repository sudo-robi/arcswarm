import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { VaultForm } from './vault-form';

describe('VaultForm a11y', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<VaultForm isActive />);
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('should have proper labels and roles', () => {
    const { getByRole } = render(<VaultForm isActive />);

    // Dialog should have proper role
    expect(getByRole('dialog')).toBeInTheDocument();

    // Create button should have proper role
    expect(getByRole('button', { name: /Create Vault/i })).toBeInTheDocument();
  });
});
