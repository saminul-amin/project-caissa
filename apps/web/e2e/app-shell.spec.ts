import { createServer, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Locator } from "@playwright/test";

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

test("a timed local game starts explicitly, plays, reloads, and continues", async ({ page }) => {
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
  await page.getByRole("button", { name: "Create Game" }).click();

  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("heading", { exact: true, name: "Ready" })).toBeVisible();
  await expect(page.getByRole("img", { name: /White orientation/i })).toBeVisible();
  await expect(page.getByText(/game remains ready and no clock has been started/i)).toBeVisible();
  await expect(page.getByLabel("White clock")).toHaveText("3:00");
  await expect(page.getByLabel("Black clock")).toHaveText("3:00");
  await expect(page.getByText("3 + 2")).toBeVisible();

  await page.locator("#caissa-game-board-square-e2").click();
  await page.locator("#caissa-game-board-square-e4").click();
  await expect(page.getByRole("heading", { exact: true, name: "Ready" })).toBeVisible();
  await expect(page.locator(".move-list")).toHaveCount(0);

  await page.getByRole("button", { name: "Begin Game" }).click();
  await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible();
  await expect(page.getByText(/White to move\./).last()).toBeAttached();
  await expect.poll(() => page.getByLabel("White clock").textContent()).not.toBe("3:00");

  await page.locator("#caissa-game-board-square-e2").click();
  await page.locator("#caissa-game-board-square-e4").click();
  await expect(page.getByRole("heading", { name: "Black to move" })).toBeVisible();
  await expect(page.locator(".move-list").getByText("e4")).toBeVisible();
  await expect(page.getByText(/White played e4\. Black to move\./)).toBeAttached();
  await expect.poll(() => page.getByLabel("Black clock").textContent()).not.toBe("3:00");
  const blackBeforeReload = await clockSeconds(page.getByLabel("Black clock"));

  await page.reload();

  await expect(page.getByRole("heading", { name: "Black to move" })).toBeVisible();
  await expect(page.getByRole("img", { name: /White orientation/i })).toBeVisible();
  await expect(page.locator(".move-list").getByText("e4")).toBeVisible();
  await expect
    .poll(() => clockSeconds(page.getByLabel("Black clock")))
    .toBeLessThanOrEqual(blackBeforeReload);

  await page.locator("#caissa-game-board-square-e7").click();
  await page.locator("#caissa-game-board-square-e5").click();
  await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible();
  await expect(page.locator(".move-list").getByText("e4")).toBeVisible();
  await expect(page.locator(".move-list").getByText("e5")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /timestamp-regression|illegal-move|transaction-failed|storage-unavailable/i,
  );

  await page.setViewportSize({ height: 844, width: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible();
  expect(
    await page
      .locator(".route-fade")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration)),
  ).toBeLessThanOrEqual(0.001);
});

async function clockSeconds(locator: Locator): Promise<number> {
  const value = (await locator.textContent()) ?? "";
  const match = /^(\d+):(\d{2})$/u.exec(value);
  if (!match) throw new Error(`Expected a clock value, received ${value}.`);
  return Number(match[1]) * 60 + Number(match[2]);
}
