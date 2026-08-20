import { createServer, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

const distDirectory = path.resolve("apps/web/dist");
let server: Server | undefined;

test.describe.configure({ mode: "serial" });

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

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
};

async function serveBuiltApp(requestUrl: string, response: ServerResponse): Promise<void> {
  const url = new URL(requestUrl, "http://127.0.0.1:4173");
  const isAsset = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/engine/");
  const requestedPath = isAsset ? url.pathname.slice(1) : "index.html";
  const filePath = path.resolve(distDirectory, requestedPath);

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

test("a timed local game starts explicitly, plays, reloads, and continues", async ({ page }) => {
  await page.goto("/");
  await resetDatabase(page);
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Play Chess Beyond the Best Move" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

  await page.getByRole("link", { name: "Play a Game" }).click();
  await expect(page).toHaveURL(/#\/play\/new$/);
  await expect(page.getByRole("heading", { name: "Set up your game" })).toBeVisible();

  await page.getByRole("radio", { name: /Local two-player/i }).check();
  await page.getByRole("radio", { name: /3 minutes \+ 2 seconds/i }).check();
  await page.getByRole("button", { name: "Create Game" }).click();

  await expect(page).toHaveURL(/#\/play$/);
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

test("a paused timed game reloads paused and resumes only by explicit control", async ({
  page,
}) => {
  await page.goto("/");
  await resetDatabase(page);
  await page.reload();
  await createLocalGame(page, /3 minutes \+ 2 seconds/i);
  await page.getByRole("button", { name: "Begin Game" }).click();
  await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible();
  await page.locator("#caissa-game-board-square-e2").click();
  await page.locator("#caissa-game-board-square-e4").click();
  await expect(page.getByRole("heading", { name: "Black to move" })).toBeVisible();
  await expect.poll(() => page.getByLabel("Black clock").textContent()).not.toBe("3:00");

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("heading", { name: "Paused" })).toBeFocused();
  const pausedBlack = await page.getByLabel("Black clock").textContent();
  await expect(page.getByText(/Game paused\. Neither clock is running/i)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  await expect(page.getByLabel("Black clock")).toHaveText(pausedBlack ?? "");
  await expect(page.getByRole("button", { name: "Resume" })).toBeEnabled();

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("heading", { name: "Black to move" })).toBeFocused();
  await expect(page.getByText(/Game resumed\. Black to move/i)).toBeVisible();
  await page.locator("#caissa-game-board-square-e7").click();
  await page.locator("#caissa-game-board-square-e5").click();
  await expect(page.getByRole("heading", { name: "White to move" })).toBeVisible();
  await expect(page.locator(".move-list").getByText("e4")).toBeVisible();
  await expect(page.locator(".move-list").getByText("e5")).toBeVisible();
  await expect
    .poll(() => clockSeconds(page.getByLabel("Black clock")))
    .toBeLessThanOrEqual(clockSecondsFromText(pausedBlack) + 2);
});

test("confirmed abandonment finalizes locally without awarding a winner", async ({ page }) => {
  await page.goto("/");
  await resetDatabase(page);
  await page.reload();
  await createLocalGame(page, /Untimed/i);
  await page.getByRole("button", { name: "Begin Game" }).click();
  await page.locator("#caissa-game-board-square-e2").click();
  await page.locator("#caissa-game-board-square-e4").click();
  await expect(page.locator(".move-list").getByText("e4")).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  const trigger = page.getByRole("button", { name: "End game" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "End this game?" });
  await expect(dialog).toContainText("without awarding a winner");
  await expect(dialog.getByRole("button", { name: "Keep current game" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await trigger.click();
  const confirmedDialog = page.getByRole("dialog", { name: "End this game?" });
  await expect(confirmedDialog).toBeVisible();
  await confirmedDialog.getByRole("button", { name: "End game" }).click();

  await expect(page.getByRole("heading", { name: "Abandoned" })).toBeFocused();
  await expect(
    page.getByText(/Game ended without awarding a winner\. Saved locally\./i),
  ).toBeVisible();
  await expect(page.locator(".move-list").getByText("e4")).toBeVisible();
  await expect.poll(() => readGameStoreCounts(page)).toEqual({ active: 0, completed: 1 });
  await expect(page.locator("body")).not.toContainText(
    /already-abandoned|transaction-failed|storage-unavailable|finalization-pending/i,
  );

  await page.reload();
  await expect(page.getByRole("heading", { name: "Create a game to see the board" })).toBeVisible();
  await expect.poll(() => readGameStoreCounts(page)).toEqual({ active: 0, completed: 1 });
});

async function clockSeconds(locator: Locator): Promise<number> {
  const value = (await locator.textContent()) ?? "";
  return clockSecondsFromText(value);
}

function clockSecondsFromText(value: string | null): number {
  const text = value ?? "";
  const match = /^(\d+):(\d{2})$/u.exec(text);
  if (!match) throw new Error(`Expected a clock value, received ${text}.`);
  return Number(match[1]) * 60 + Number(match[2]);
}

async function createLocalGame(page: Page, timeControl: RegExp): Promise<void> {
  await page.getByRole("link", { name: "Play a Game" }).click();
  await page.getByRole("radio", { name: /Local two-player/i }).check();
  await page.getByRole("radio", { name: timeControl }).check();
  await page.getByRole("button", { name: "Create Game" }).click();
  await expect(page.getByRole("heading", { exact: true, name: "Ready" })).toBeVisible();
}

async function resetDatabase(page: Page): Promise<void> {
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
}

async function readGameStoreCounts(page: Page): Promise<{ active: number; completed: number }> {
  return page.evaluate(
    (databaseName) =>
      new Promise<{ active: number; completed: number }>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.addEventListener("error", () => {
          reject(request.error ?? new Error("Database read failed."));
        });
        request.addEventListener("success", () => {
          const database = request.result;
          const transaction = database.transaction(["activeGames", "completedGames"], "readonly");
          const activeRequest = transaction.objectStore("activeGames").count();
          const completedRequest = transaction.objectStore("completedGames").count();
          transaction.addEventListener("complete", () => {
            database.close();
            resolve({ active: activeRequest.result, completed: completedRequest.result });
          });
          transaction.addEventListener("error", () => {
            reject(transaction.error ?? new Error("Database count transaction failed."));
          });
        });
      }),
    "caissa",
  );
}
