import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import {
  getCalendarBalanceIndicator,
  NanaPointApp,
} from "./NanaPointApp";

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

  it("shows worked-holiday hours as a positive calendar credit", () => {
    const indicator = getCalendarBalanceIndicator({
      date: "2026-10-12",
      day: 12,
      entries: [
        {
          id: "entry-1",
          userId: "user-test",
          occurredAt: "2026-10-12T08:15:00-03:00",
          type: "arrival",
        },
      ],
      breaks: [],
      mark: {
        id: "worked-holiday-1",
        userId: "user-test",
        date: "2026-10-12",
        type: "worked_holiday",
      },
      balanceMinutes: 7 * 60 + 7,
      workedMinutes: 7 * 60 + 7,
      status: "exceeded",
      dayStatus: "closed",
    } as Parameters<typeof getCalendarBalanceIndicator>[0]);

    expect(indicator).toMatchObject({
      direction: "up",
      label: "+7h 7min",
    });
  });

  it("shows hours logged on a manually marked holiday as positive credit", () => {
    const indicator = getCalendarBalanceIndicator({
      date: "2026-10-15",
      day: 15,
      entries: [
        {
          id: "arrival-2026-10-15",
          userId: "user-test",
          occurredAt: "2026-10-15T09:37:00-03:00",
          type: "arrival",
        },
        {
          id: "departure-2026-10-15",
          userId: "user-test",
          occurredAt: "2026-10-15T11:06:00-03:00",
          type: "departure",
        },
      ],
      breaks: [],
      mark: {
        id: "holiday-2026-10-15",
        userId: "user-test",
        date: "2026-10-15",
        type: "holiday",
      },
      balanceMinutes: 89,
      workedMinutes: 89,
      status: "holiday",
      dayStatus: "closed",
    } as Parameters<typeof getCalendarBalanceIndicator>[0]);

    expect(indicator).toMatchObject({
      direction: "up",
      label: "+1h 29min",
    });
  });
});
