/**
 * Viewport screenshot helper for the bug reporter.
 *
 * html2canvas-pro is dynamically imported so it never lands in the main bundle —
 * it's only pulled in when a tester actually opens the panel. We use the `-pro`
 * fork (not classic html2canvas) because this app is Tailwind 4, whose default
 * palette uses `oklch()` colors that classic html2canvas can't parse.
 */

export type Screenshot = {
  blob: Blob;
  width: number;
  height: number;
};

// Hidden during capture so the screenshot shows the real page, not the panel.
const HIDE_SELECTORS = ["[data-support-widget]"];

export async function captureViewport(): Promise<Screenshot> {
  const { default: html2canvas } = await import("html2canvas-pro");

  const hidden: Array<{ el: HTMLElement; prev: string }> = [];
  for (const selector of HIDE_SELECTORS) {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      hidden.push({ el, prev: el.style.display });
      el.style.display = "none";
    });
  }

  try {
    const canvas = await html2canvas(document.body, {
      // Current viewport only — not the whole scrollable page. We offset the
      // render origin by the scroll position (scrollX/scrollY: -scroll) rather
      // than cropping with x/y: in html2canvas-pro v2 the x/y crop ignores the
      // scroll offset on a scrolled page and captures the top of the document
      // (or a garbled overlay) instead of what's on screen. windowWidth/Height
      // pin the clone to the real viewport so layout matches 1:1.
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      scale: 1,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      // html2canvas renders a fresh clone of the DOM in an off-screen iframe,
      // which RESTARTS every CSS animation from time 0. Entrance animations like
      // `.rise` start at `opacity: 0` / `translateY(28px)`, so the clone captures
      // them invisible — that's why the homepage hero (and any `.rise`/`.pop-in`
      // section) came out blank. Snap every animation to its final keyframe in
      // the clone so elements render in their resting state.
      onclone: (doc: Document) => {
        const style = doc.createElement("style");
        style.textContent =
          "*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;animation-fill-mode:forwards!important;transition:none!important;}";
        doc.head.appendChild(style);
      },
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Screenshot encode failed"))),
        "image/jpeg",
        0.85,
      );
    });

    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    for (const { el, prev } of hidden) el.style.display = prev;
  }
}
