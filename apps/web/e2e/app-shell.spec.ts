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

test("the application shell exposes accessible Phase 1 navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

  await page.getByRole("link", { name: "Play" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByText("Chess gameplay has not been implemented yet.")).toBeVisible();
});
