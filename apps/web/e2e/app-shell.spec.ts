import { createServer, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const distDirectory = path.resolve("apps/web/dist");
let server: Server | undefined;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    void serveBuiltApp(request.url ?? "/", response);
  });

  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(4173, "127.0.0.1", resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

async function serveBuiltApp(requestUrl: string, response: ServerResponse): Promise<void> {
  const url = new URL(requestUrl, "http://127.0.0.1:4173");
  const requestedPath = url.pathname.startsWith("/assets/") ? url.pathname.slice(1) : "index.html";
  const filePath = path.resolve(distDirectory, requestedPath);

  if (!filePath.startsWith(distDirectory)) {
    response.writeHead(400).end("Invalid path");
    return;
  }

  try {
    const content = await readFile(filePath);
    const contentType = filePath.endsWith(".css")
      ? "text/css"
      : filePath.endsWith(".js")
        ? "text/javascript"
        : "text/html";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
}

test("a fresh local game remains ready after creation and restoration", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(
    (databaseName) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.addEventListener("success", () => {
          resolve();
        });
        request.addEventListener("error", () => {
          reject(request.error ?? new Error("Database cleanup failed."));
        });
        request.addEventListener("blocked", () => {
          reject(new Error("Database cleanup was blocked."));
        });
      }),
    "caissa",
  );
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Play Chess Beyond the Best Move" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

  await page.getByRole("link", { name: "Play a Game" }).click();
  await expect(page).toHaveURL(/\/play\/new$/);
  await expect(page.getByRole("heading", { name: "Create a game" })).toBeVisible();

  await page.getByRole("radio", { name: /3 minutes \+ 2 seconds/i }).check();
  await page.getByRole("radio", { name: /^Black$/i }).check();
  await page.getByRole("checkbox", { name: /Allow undo/i }).uncheck();
  await page.getByRole("button", { name: "Create Game" }).click();

  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Black orientation/i })).toBeVisible();
  await expect(page.getByText(/game remains ready and no clock has been started/i)).toBeVisible();
  await expect(page.getByLabel("White clock")).toHaveText("3:00");
  await expect(page.getByLabel("Black clock")).toHaveText("3:00");
  await expect(page.getByText("3 + 2")).toBeVisible();
  await expect(page.getByText("Disabled")).toBeVisible();
  await expect(page.getByText("Active turn")).toHaveCount(0);

  await page.reload();

  await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible();
  await expect(page.getByRole("img", { name: /White orientation/i })).toBeVisible();
  await expect(page.getByLabel("White clock")).toHaveText("3:00");
  await expect(page.getByLabel("Black clock")).toHaveText("3:00");
  await expect(page.getByText("Active turn")).toHaveCount(0);

  await page.setViewportSize({ height: 844, width: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible();
  expect(
    await page
      .locator(".route-fade")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration)),
  ).toBeLessThanOrEqual(0.001);
});
