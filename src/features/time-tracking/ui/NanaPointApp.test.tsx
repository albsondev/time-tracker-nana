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
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    renderApp();

    expect(await screen.findByText("Nana's Point")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar com google/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /modo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/o acesso ainda não está disponível/i)).toBeInTheDocument();
  });
});
