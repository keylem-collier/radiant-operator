# Fluid UI Motion

## Description

Use this skill for smooth state continuity across frontend UI: page transitions, tab switches, shared-element moves, expanding details, filtering/sorting lists, route-level view changes, and dashboard panels that should feel continuous rather than jumpy.

## Current Signals

- Native View Transition API is increasingly useful for same-document and cross-document transitions.
- Motion for React layout animations are strong for React component tree changes.
- Fluid motion should reduce cognitive load by preserving context during a change.

## Workflow

1. Map the before and after states: what should remain visually continuous?
2. Prefer native CSS or View Transitions for lightweight route/state changes.
3. Use Motion layout animation for React components that resize, reorder, or move.
4. Animate only the continuity anchor. Do not animate every child.
5. Keep transitions short enough that repeated use feels efficient.
6. Add feature detection and reduced-motion fallbacks.
7. Verify with real interaction, not static screenshot only.

## Native View Transition Pattern

```ts
export function runViewTransition(update: () => void) {
  if (!document.startViewTransition) {
    update();
    return;
  }

  document.startViewTransition(update);
}
```

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 1ms;
  }
}
```

## Motion Layout Pattern

```tsx
import { motion, useReducedMotion } from "motion/react";

export function FluidPanel({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      layout={reduceMotion ? false : true}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
    >
      {children}
    </motion.section>
  );
}
```

## Quality Bar

- The user can tell what changed and where it went.
- The transition does not delay input.
- Mobile layout remains stable during and after the motion.
- Reduced motion preserves continuity through immediate state and clear visual hierarchy.

## Avoid

- Page-wide fades for every navigation.
- Animating both old and new states so aggressively that they overlap confusingly.
- Shared-element transitions without stable dimensions.
- Route transitions that hide loading or error state.

## Sources

- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using
- https://motion.dev/docs/react
