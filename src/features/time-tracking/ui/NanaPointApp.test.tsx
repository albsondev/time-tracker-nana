import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
  it("allows entering demo mode and viewing the today dashboard", async () => {
    renderApp();

    await userEvent.click(screen.getByRole("button", { name: /ver modo demo/i }));

    expect(screen.getByText("Olá, Nana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sair para almoço/i })).toBeInTheDocument();
    expect(screen.getByText("Saldo semanal")).toBeInTheDocument();
  });

  it("navigates to the calendar through the bottom menu", async () => {
    renderApp();

    await userEvent.click(screen.getByRole("button", { name: /ver modo demo/i }));
    await userEvent.click(screen.getByRole("button", { name: /calendário/i }));

    expect(await screen.findByRole("heading", { name: "Calendário" })).toBeInTheDocument();
    expect(await screen.findByText("abril de 2026")).toBeInTheDocument();
  });
});
