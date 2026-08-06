import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CaissaAppProvider, useCaissaApp } from "./CaissaAppProvider";
import { createTestApplication } from "../test/caissa-app-test-kit";

function Probe() {
  const { activeGame, startup } = useCaissaApp();
  return <p>{`${startup.status}:${activeGame?.session.lifecycle.phase ?? "none"}`}</p>;
}

describe("CaissaAppProvider", () => {
  it("creates one application and runs startup once under StrictMode", async () => {
    const { application } = createTestApplication();
    const restore = vi.spyOn(application.startupService, "restoreActiveGame");
    const createApplication = vi.fn(() => application);
    render(
      <StrictMode>
        <CaissaAppProvider createApplication={createApplication}>
          <Probe />
        </CaissaAppProvider>
      </StrictMode>,
    );
    await screen.findByText("no-active-game:none");
    expect(createApplication).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("does not recreate services on an ordinary rerender", async () => {
    const { application } = createTestApplication();
    const createApplication = vi.fn(() => application);
    const view = render(
      <CaissaAppProvider createApplication={createApplication}>
        <Probe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none");
    view.rerender(
      <CaissaAppProvider createApplication={createApplication}>
        <Probe />
      </CaissaAppProvider>,
    );
    expect(createApplication).toHaveBeenCalledTimes(1);
  });

  it("closes an owned application after true unmount", async () => {
    const { application } = createTestApplication();
    const close = vi.fn();
    const ownedApplication = { ...application, close };
    const view = render(
      <CaissaAppProvider
        createApplication={() => {
          return ownedApplication;
        }}
      >
        <Probe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none");
    view.unmount();
    await waitFor(() => {
      expect(close).toHaveBeenCalledTimes(1);
    });
  });

  it("does not close an externally owned application", async () => {
    const { application } = createTestApplication();
    const close = vi.fn();
    const externalApplication = { ...application, close };
    const view = render(
      <CaissaAppProvider application={externalApplication}>
        <Probe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none");
    view.unmount();
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
  });
});
