"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { resetChapterScroll } from "@/lib/chapter-scroll";

export function useChapterScroll(
  ref: RefObject<HTMLElement | null>,
  chapter: string | number,
  { resetPage = false, skipInitial = false, focusHeading = true } = {},
) {
  const previous = useRef<string | number | undefined>(undefined);
  useLayoutEffect(() => {
    const first = previous.current === undefined;
    const changed = previous.current !== chapter;
    previous.current = chapter;
    if (!changed || !ref.current || (skipInitial && first)) return;
    resetChapterScroll(ref.current, resetPage, focusHeading);
  }, [ref, chapter, resetPage, skipInitial, focusHeading]);
}
