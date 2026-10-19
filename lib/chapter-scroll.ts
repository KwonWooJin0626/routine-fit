/** Reset only on a committed chapter change, never on ordinary input updates. */
export function resetChapterScroll(root: HTMLElement, resetPage = false, focusHeading = true) {
  if (focusHeading) {
    const heading = root.querySelector<HTMLElement>("[data-step-heading]") ?? root.querySelector<HTMLElement>("[data-chapter-heading], h1, h2");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }
  // Includes independently scrolling panels and text areas within this chapter.
  // Keep horizontal position: changing chapters should not move the chosen day sideways.
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    if (element.scrollTop > 0) element.scrollTo({ top: 0, behavior: "instant" });
  }
  root.scrollTo({ top: 0, behavior: "instant" });
  if (resetPage) root.ownerDocument.defaultView?.scrollTo({ top: 0, behavior: "instant" });
}
