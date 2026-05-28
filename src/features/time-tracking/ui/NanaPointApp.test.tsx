import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { NanaPointApp } from "./NanaPointApp";

function renderApp() {
  return render(
    <AppProviders>
      <NanaPointApp />
    </AppProviders>,
  );
}

describe("NanaPointApp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the user-facing login screen without local bypass access", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    renderApp();

    expect(await screen.findByText("Nana's Point")).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^entrar$/i }).some((button) => button.hasAttribute("disabled")),
    ).toBe(true);
    expect(screen.getByRole("button", { name: /criar cadastro/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /modo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/o acesso ainda não está disponível/i)).toBeInTheDocument();
  }, 15_000);
});
