import { describe, expect, it, vi } from "vitest";

import { revealRowInList } from "./list-scroll";

function fakeList(scrollTop: number, clientHeight: number) {
  const scrollTo = vi.fn();
  const list = {
    clientHeight,
    getBoundingClientRect: () => ({ top: 100 }),
    scrollTo,
    scrollTop,
  } as unknown as HTMLElement;
  return { list, scrollTo };
}

function fakeRow(top: number, height: number): HTMLElement {
  return { getBoundingClientRect: () => ({ height, top }) } as unknown as HTMLElement;
}

describe("revealRowInList", () => {
  it("leaves a visible row alone", () => {
    const { list, scrollTo } = fakeList(0, 200);
    revealRowInList(list, fakeRow(150, 20), { reduceMotion: false });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls the list down just far enough to show a row below the fold", () => {
    const { list, scrollTo } = fakeList(0, 200);
    // Row sits 300px below the list top, so its bottom is at 320 within the list.
    revealRowInList(list, fakeRow(400, 20), { reduceMotion: false });
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", top: 120 });
  });

  it("scrolls up to a row above the current viewport without animation when motion is reduced", () => {
    const { list, scrollTo } = fakeList(300, 200);
    // The row is 50px into the list content, above the current scroll offset of 300.
    revealRowInList(list, fakeRow(-150, 20), { reduceMotion: true });
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 50 });
  });

  it("falls back to setting scrollTop where scrollTo is unavailable", () => {
    const list = {
      clientHeight: 100,
      getBoundingClientRect: () => ({ top: 0 }),
      scrollTop: 0,
    } as unknown as HTMLElement;
    revealRowInList(list, fakeRow(500, 20), { reduceMotion: true });
    expect(list.scrollTop).toBe(420);
  });
});
