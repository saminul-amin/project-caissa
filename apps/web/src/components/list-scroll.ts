/**
 * Keeps a row visible inside its own scrolling list without moving anything else.
 *
 * `Element.scrollIntoView` scrolls every scrollable ancestor, and the application shell is
 * one of them, so following the current move would drag the whole page. Adjusting only the
 * list's own scroll offset keeps the page where the reader left it.
 */
export function revealRowInList(
  list: HTMLElement,
  row: HTMLElement,
  options: { readonly reduceMotion: boolean },
): void {
  const offset = rowOffsetWithin(list, row);
  const top = list.scrollTop;
  const bottom = top + list.clientHeight;
  let target: number | undefined;
  if (offset.top < top) target = offset.top;
  else if (offset.bottom > bottom) target = offset.bottom - list.clientHeight;
  if (target === undefined) return;
  if (typeof list.scrollTo === "function") {
    list.scrollTo({ behavior: options.reduceMotion ? "auto" : "smooth", top: target });
  } else {
    list.scrollTop = target;
  }
}

function rowOffsetWithin(
  list: HTMLElement,
  row: HTMLElement,
): { readonly bottom: number; readonly top: number } {
  const listRect = list.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const top = rowRect.top - listRect.top + list.scrollTop;
  return { bottom: top + rowRect.height, top };
}
