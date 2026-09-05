import { createServer, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * Exercises the release-critical path that no unit test can prove: the real WebAssembly
 * engine loading in a browser, playing a move, and then analysing the saved game.
 */
const distDirectory = path.resolve("apps/web/dist");
let server: Server | undefined;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
};

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.beforeAll(async () => {
  server = createServer((request, response) => {
    void serveBuiltApp(request.url ?? "/", response);
  });
  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(4174, "127.0.0.1", resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => {
      resolve();
    });
  });
});

async function serveBuiltApp(requestUrl: string, response: ServerResponse): Promise<void> {
  const url = new URL(requestUrl, "http://127.0.0.1:4174");
  const isAsset = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/engine/");
  const filePath = path.resolve(distDirectory, isAsset ? url.pathname.slice(1) : "index.html");

  if (!filePath.startsWith(distDirectory)) {
    response.writeHead(400).end("Invalid path");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
}

const baseUrl = "http://127.0.0.1:4174/";

test("the bundled engine answers a move and the saved game can be reviewed", async ({ page }) => {
  await page.goto(baseUrl);
  await resetDatabase(page);
  await page.reload();

  await page.getByRole("link", { name: "Play a Game" }).click();
  await expect(page.getByRole("heading", { name: "Set up your game" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Play the engine/i })).toBeChecked();
  await expect(page.getByText(/not human ratings/i)).toBeVisible();

  await page.getByRole("radio", { name: /Newcomer/i }).check();
  await page.getByRole("radio", { name: /^Untimed/i }).check();
  await page.getByRole("button", { name: "Create Game" }).click();

  await expect(page.getByRole("heading", { exact: true, name: "Ready" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Caissa Newcomer" })).toBeVisible();

  await page.getByRole("button", { name: "Begin Game" }).click();
  await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible();

  await page.locator("#caissa-game-board-square-e2").click();
  await page.locator("#caissa-game-board-square-e4").click();

  // The engine downloads on the first opponent turn, so this is the slow assertion.
  await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator(".move-list li")).toHaveCount(1);
  const firstRow = await page.locator(".move-list li").first().textContent();
  expect(firstRow).toMatch(/^1\.e4\S+/u);

  await page.getByRole("button", { name: "End game" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "End game" }).click();

  await expect(page.getByRole("heading", { name: "Game ended" })).toBeVisible();
  await page.getByRole("button", { name: "Review This Game" }).click();

  await expect(page.getByRole("heading", { name: "Game review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Key moments" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("heading", { name: "Every move" })).toBeVisible();
  await expect(page.getByText(/Accuracy/).first()).toBeVisible();
  await expect(page.getByText(/not a rating/i)).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Game history" })).toBeVisible();
  await expect(page.getByText("You vs Caissa Newcomer")).toBeVisible();
  await expect(page.getByText(/Reviewed/)).toBeVisible();
});

test("engine settings and local data controls are reachable and honest", async ({ page }) => {
  await page.goto(`${baseUrl}#/settings`);

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText(/Stockfish 18/)).toBeVisible();
  await expect(page.getByRole("link", { name: "GPL-3.0-or-later" })).toBeVisible();
  await expect(page.getByText(/no accounts and no servers/i)).toBeVisible();

  await page.getByLabel("Board theme").selectOption("linen");
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-board-theme", "linen");

  await page.reload();
  await expect(page.getByLabel("Board theme")).toHaveValue("linen");
});

test("switching the theme repaints the whole page, not only new elements", async ({ page }) => {
  await page.goto(`${baseUrl}#/settings`);
  await page.getByLabel("Interface theme").selectOption("dark");
  await expect(page.getByText("Settings saved.")).toBeVisible();

  const darkShell = await shellColors(page);
  expect(darkShell.background).toBe("rgb(13, 12, 10)");
  expect(darkShell.text).toBe("rgb(245, 239, 228)");

  await page.getByLabel("Interface theme").selectOption("light");
  await expect.poll(async () => (await shellColors(page)).background).toBe("rgb(243, 238, 228)");

  const lightShell = await shellColors(page);
  expect(lightShell.text).toBe("rgb(28, 25, 21)");
  // A heading that existed before the switch must repaint too, not just the shell.
  const headingColor = await page
    .getByRole("heading", { name: "Settings" })
    .evaluate((element) => getComputedStyle(element).color);
  expect(headingColor).toBe("rgb(28, 25, 21)");

  await page.reload();
  await expect.poll(async () => (await shellColors(page)).background).toBe("rgb(243, 238, 228)");

  await page.getByLabel("Interface theme").selectOption("dark");
  await expect.poll(async () => (await shellColors(page)).background).toBe("rgb(13, 12, 10)");
});

test("history, review, and settings fit a phone without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });

  for (const route of ["#/", "#/play/new", "#/history", "#/settings"]) {
    await page.goto(`${baseUrl}${route}`);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

async function shellColors(page: Page): Promise<{ background: string; text: string }> {
  return page.locator(".app-shell").evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, text: style.color };
  });
}

async function resetDatabase(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase("caissa");
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          resolve();
        };
        request.onblocked = () => {
          resolve();
        };
      }),
  );
}

test("the app scrolls itself inside a non-scrolling iframe, as itch.io embeds it", async ({
  page,
}) => {
  // itch.io serves HTML5 projects in an iframe with scrolling="no". A page that relies on
  // the document scrolling loses everything below the fold there.
  await page.setContent(
    `<html><body style="margin:0">
       <iframe src="${baseUrl}#/play/new" width="1280" height="800" scrolling="no"
               style="border:0"></iframe>
     </body></html>`,
  );
  const frame = page.frameLocator("iframe");
  await expect(frame.getByRole("heading", { name: "Set up your game" })).toBeVisible();

  const shell = frame.locator(".app-shell");
  const metrics = await shell.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  await shell.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await shell.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  // The submit button lives below the fold; it must be reachable without a document scroll.
  await expect(frame.getByRole("button", { name: "Create Game" })).toBeInViewport();
});
