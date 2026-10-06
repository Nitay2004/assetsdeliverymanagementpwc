type RowFocusRouter = {
  replace: (href: string, opts?: { scroll?: boolean }) => void;
  refresh: () => void;
};

/**
 * After a save, point the URL at the saved row: drop `page` (the list may have
 * re-paged around it) and set `selected` so `getCorrectOrderPage` redirects to
 * whatever page now holds it and `ScrollToItem` scrolls it into view.
 *
 * `refresh()` is kept so the row reflects the write even when the action did
 * not call `revalidatePath`.
 */
export function focusSavedRow(router: RowFocusRouter, rowId: string) {
  const params = new URLSearchParams(window.location.search);
  params.delete("page");
  params.set("selected", rowId);
  router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  router.refresh();
}
