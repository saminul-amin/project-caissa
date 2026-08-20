import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "../../application/settings";
import { useCaissaApp } from "../../app/CaissaAppProvider";
import { SettingsPage } from "./SettingsPage";

vi.mock("../../app/CaissaAppProvider", () => ({ useCaissaApp: vi.fn() }));

interface Harness {
  readonly clearHistory: ReturnType<typeof vi.fn>;
  readonly resetPreferences: ReturnType<typeof vi.fn>;
  readonly savePreferences: ReturnType<typeof vi.fn>;
}

function install(
  overrides: Partial<Harness> = {},
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): Harness {
  const harness: Harness = {
    clearHistory: overrides.clearHistory ?? vi.fn(() => Promise.resolve({ status: "cleared" })),
    resetPreferences: overrides.resetPreferences ?? vi.fn(() => Promise.resolve("saved")),
    savePreferences: overrides.savePreferences ?? vi.fn(() => Promise.resolve("saved")),
  };
  vi.mocked(useCaissaApp).mockReturnValue({
    actions: {
      resetPreferences: harness.resetPreferences,
      savePreferences: harness.savePreferences,
    } as never,
    activeGame: undefined,
    application: { historyService: { clearHistory: harness.clearHistory } } as never,
    opponentStatus: { kind: "idle" },
    preferences,
    startup: { status: "no-active-game" },
  });
  return harness;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsPage", () => {
  it("saves a changed appearance preference with every other value preserved", async () => {
    const harness = install();
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.selectOptions(screen.getByLabelText("Interface theme"), "light");

    await waitFor(() => {
      expect(harness.savePreferences).toHaveBeenCalledExactlyOnceWith({
        ...DEFAULT_USER_PREFERENCES,
        theme: "light",
      });
    });
    expect(await screen.findByText("Settings saved.")).toBeVisible();
  });

  it("saves a board theme and a motion preference", async () => {
    const harness = install();
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.selectOptions(screen.getByLabelText("Board theme"), "linen");
    await user.selectOptions(screen.getByLabelText("Motion"), "reduce");

    expect(harness.savePreferences).toHaveBeenCalledTimes(2);
  });

  it("toggles coordinates and sound", async () => {
    const harness = install();
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("checkbox", { name: /Show board coordinates/ }));
    await user.click(screen.getByRole("checkbox", { name: /Enable sound/ }));

    expect(harness.savePreferences).toHaveBeenNthCalledWith(1, {
      ...DEFAULT_USER_PREFERENCES,
      coordinatesVisible: false,
    });
    expect(harness.savePreferences).toHaveBeenNthCalledWith(2, {
      ...DEFAULT_USER_PREFERENCES,
      soundEnabled: false,
    });
  });

  it("disables move sounds when sound is off entirely", () => {
    install({}, { ...DEFAULT_USER_PREFERENCES, soundEnabled: false });
    render(<SettingsPage />);

    expect(screen.getByRole("checkbox", { name: /Move sounds/ })).toBeDisabled();
  });

  it("says plainly when a setting could not be stored", async () => {
    install({ savePreferences: vi.fn(() => Promise.resolve("failed")) });
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.selectOptions(screen.getByLabelText("Interface theme"), "dark");

    expect(await screen.findByText(/applies for this session only/)).toBeVisible();
  });

  it("requires confirmation before deleting local data and then clears both stores", async () => {
    const harness = install();
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Delete All Caissa Data" }));
    expect(harness.clearHistory).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete Everything" }));

    await waitFor(() => {
      expect(harness.clearHistory).toHaveBeenCalledExactlyOnceWith({
        confirmation: "clear-completed-game-history",
      });
    });
    expect(harness.resetPreferences).toHaveBeenCalledOnce();
    expect(await screen.findByText(/All Caissa data on this device was deleted./)).toBeVisible();
  });

  it("keeps data when the deletion dialog is cancelled", async () => {
    const harness = install();
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Delete All Caissa Data" }));
    await user.click(screen.getByRole("button", { name: "Keep My Data" }));

    expect(harness.clearHistory).not.toHaveBeenCalled();
  });

  it("warns when data could not be fully deleted", async () => {
    install({ clearHistory: vi.fn(() => Promise.resolve({ error: {}, status: "failed" })) });
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Delete All Caissa Data" }));
    await user.click(screen.getByRole("button", { name: "Delete Everything" }));

    expect(await screen.findByText(/Some data may remain./)).toBeVisible();
  });

  it("discloses the bundled engine and its licence", () => {
    install();
    render(<SettingsPage />);

    expect(screen.getByText(/Stockfish 18/)).toBeVisible();
    expect(screen.getByRole("link", { name: "GPL-3.0-or-later" })).toHaveAttribute(
      "rel",
      "noreferrer noopener",
    );
    expect(screen.getByText(/GNU General Public License/)).toBeVisible();
  });
});
