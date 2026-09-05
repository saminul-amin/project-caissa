import { describe, expect, it } from "vitest";

import { applyThemePalette, selectThemeVariables } from "./theme-palettes";

describe("selectThemeVariables", () => {
  it("returns a distinct palette for each theme", () => {
    const dark = selectThemeVariables({ boardTheme: "caissa-classic", theme: "dark" });
    const light = selectThemeVariables({ boardTheme: "caissa-classic", theme: "light" });

    expect(dark["--color-bg-app"]).toBe("#0d0c0a");
    expect(light["--color-bg-app"]).toBe("#f3eee4");
    expect(dark["--color-text-primary"]).not.toBe(light["--color-text-primary"]);
  });

  it("defines exactly the same variable names in both themes", () => {
    const dark = Object.keys(selectThemeVariables({ boardTheme: "linen", theme: "dark" })).sort();
    const light = Object.keys(selectThemeVariables({ boardTheme: "linen", theme: "light" })).sort();

    expect(dark).toEqual(light);
  });

  it("layers the board palette over the interface palette", () => {
    const classic = selectThemeVariables({ boardTheme: "caissa-classic", theme: "dark" });
    const linen = selectThemeVariables({ boardTheme: "linen", theme: "dark" });

    expect(classic["--color-board-light-square"]).toBe("#cfc4af");
    expect(linen["--color-board-light-square"]).toBe("#ece3d2");
    expect(classic["--color-bg-app"]).toBe(linen["--color-bg-app"]);
  });

  it("keeps the board palette independent of the interface theme", () => {
    expect(
      selectThemeVariables({ boardTheme: "linen", theme: "light" })["--color-board-check"],
    ).toBe(selectThemeVariables({ boardTheme: "linen", theme: "dark" })["--color-board-check"]);
  });
});

describe("applyThemePalette", () => {
  it("writes every variable and the matching colour scheme onto the element", () => {
    const root = document.createElement("html");

    applyThemePalette(root, { boardTheme: "linen", theme: "light" });

    expect(root.style.getPropertyValue("--color-bg-app")).toBe("#f3eee4");
    expect(root.style.getPropertyValue("--color-board-light-square")).toBe("#ece3d2");
    expect(root.style.getPropertyValue("color-scheme")).toBe("light");
  });

  it("replaces a previously applied palette rather than merging with it", () => {
    const root = document.createElement("html");

    applyThemePalette(root, { boardTheme: "linen", theme: "light" });
    applyThemePalette(root, { boardTheme: "caissa-classic", theme: "dark" });

    expect(root.style.getPropertyValue("--color-bg-app")).toBe("#0d0c0a");
    expect(root.style.getPropertyValue("--color-board-light-square")).toBe("#cfc4af");
    expect(root.style.getPropertyValue("color-scheme")).toBe("dark");
  });
});
