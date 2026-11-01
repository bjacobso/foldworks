import * as stylex from "@stylexjs/stylex";

import { motion } from "./tokens.stylex.js";

/** Shared transition recipes for presence, overlays, and conditional content. */
export const animationStyles = stylex.create({
  fade: {
    opacity: { default: 1, ":is([data-closed])": 0 },
    transitionProperty: "opacity",
    transitionDuration: { default: motion.normal, "@media (prefers-reduced-motion: reduce)": "0s" },
    transitionTimingFunction: motion.easeOut,
  },
  slideUp: {
    transform: { default: "translateY(0)", ":is([data-closed])": "translateY(12px)" },
    transitionProperty: "opacity, transform",
    transitionDuration: { default: motion.normal, "@media (prefers-reduced-motion: reduce)": "0s" },
    transitionTimingFunction: motion.easeOut,
  },
  slideDown: {
    transform: { default: "translateY(0)", ":is([data-closed])": "translateY(-12px)" },
    transitionProperty: "opacity, transform",
    transitionDuration: { default: motion.normal, "@media (prefers-reduced-motion: reduce)": "0s" },
    transitionTimingFunction: motion.easeOut,
  },
  slideLeft: {
    transform: { default: "translateX(0)", ":is([data-closed])": "translateX(16px)" },
    transitionProperty: "opacity, transform",
    transitionDuration: { default: motion.normal, "@media (prefers-reduced-motion: reduce)": "0s" },
    transitionTimingFunction: motion.easeOut,
  },
  slideRight: {
    transform: { default: "translateX(0)", ":is([data-closed])": "translateX(-16px)" },
    transitionProperty: "opacity, transform",
    transitionDuration: { default: motion.normal, "@media (prefers-reduced-motion: reduce)": "0s" },
    transitionTimingFunction: motion.easeOut,
  },
  collapse: {
    display: "grid",
    gridTemplateRows: { default: "1fr", ":is([data-closed])": "0fr" },
    opacity: { default: 1, ":is([data-closed])": 0 },
    overflow: "hidden",
    transitionProperty: "grid-template-rows, opacity",
    transitionDuration: { default: motion.normal, "@media (prefers-reduced-motion: reduce)": "0s" },
    transitionTimingFunction: motion.easeOut,
  },
});
