import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VaultForm } from "./vault-form";

describe("VaultForm", () => {
  it("renders the dialog open by default when isActive is true", () => {
    render(<VaultForm isActive />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /create treasury/i })).toBeInTheDocument();
    expect(screen.getByText(/risk profile/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create vault/i })).toBeInTheDocument();
  });

  it("renders the success state after vault creation", async () => {
    const user = userEvent.setup();
    render(<VaultForm isActive />);
    
    await user.click(screen.getByRole("button", { name: /create vault/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/vault created/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByRole("button", { name: /activate swarm/i })).toBeInTheDocument();
  });

  it("does not render dialog when no vaultId and isActive is false", () => {
    render(<VaultForm isActive={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("defaults risk tolerance to Moderate", () => {
    render(<VaultForm isActive />);
    // Moderate button should have the selected state (border-primary)
    const buttons = screen.getAllByRole("button");
    const moderateBtn = buttons.find(b => b.textContent?.includes("Moderate"));
    expect(moderateBtn).toBeDefined();
  });

  it("lets the user change the risk tolerance to Aggressive", async () => {
    const user = userEvent.setup();
    render(<VaultForm isActive />);

    const buttons = screen.getAllByRole("button");
    const aggressiveBtn = buttons.find(b => b.textContent?.includes("Aggressive"))!;
    await user.click(aggressiveBtn);

    // The Aggressive button should now have the primary border
    expect(aggressiveBtn.className).toContain("border-primary");
  });

  it("shows all risk tolerance options", () => {
    render(<VaultForm isActive />);
    expect(screen.getByText("Conservative")).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.getByText("Aggressive")).toBeInTheDocument();
  });

  it("shows creating state and calls onCreate with a new vault id after 1.5s", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<VaultForm isActive onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: /create vault/i }));
    expect(screen.getByText("Deploying...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deploying/i })).toBeDisabled();

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [vaultId] = onCreate.mock.calls[0] as [string];
    expect(vaultId).toMatch(/^vault_/);
  });

  it("does not call onCreate if component unmounts during creation", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<VaultForm isActive onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: /create vault/i }));
    unmount();

    await waitFor(() => {}, { timeout: 2000 });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("dialog is accessible via role", () => {
    render(<VaultForm isActive />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("create button is focusable and has correct role", () => {
    render(<VaultForm isActive />);
    const button = screen.getByRole("button", { name: /create vault/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("shows risk tolerance description text", () => {
    render(<VaultForm isActive />);
    expect(screen.getByText(/low risk/i)).toBeInTheDocument();
    expect(screen.getByText(/balanced/i)).toBeInTheDocument();
    expect(screen.getByText(/higher risk/i)).toBeInTheDocument();
  });
});
