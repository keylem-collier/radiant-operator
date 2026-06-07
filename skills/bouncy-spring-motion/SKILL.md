# Bouncy Spring Motion

## Description

Use this skill when the user asks for bouncy, springy, tactile, playful, or fluid-feeling frontend motion in React UI. Best fits: toggles, draggable controls, selected states, expanding panels, cards, chips, drawers, and optimistic feedback after successful user action.

## Current Signals

- Motion for React is the default React choice for spring physics, gestures, component state transitions, and layout animation.
- Spring motion should communicate physical feedback, not decorate every element.
- Bouncy motion belongs on low-risk, reversible, playful, or celebratory interactions.

## Workflow

1. Decide whether the element should feel crisp, soft, or playful.
2. Use `type: "spring"` for tactile feedback and layout changes.
3. Tune `stiffness`, `damping`, and `mass` by feel in browser, not by theory alone.
4. Keep bounce localized. Parent layout should remain stable.
5. Use reduced motion to replace spring movement with instant state or a short opacity change.
6. Check mobile tap behavior. Spring effects that feel good on hover may feel heavy on touch.

## Suggested Spring Presets

```ts
export const springPresets = {
  crisp: { type: "spring", stiffness: 520, damping: 38, mass: 0.8 },
  soft: { type: "spring", stiffness: 260, damping: 26, mass: 1 },
  playful: { type: "spring", stiffness: 420, damping: 18, mass: 0.9 },
};
```

## Motion for React Pattern

```tsx
import { motion, useReducedMotion } from "motion/react";

export function SpringButton(props: React.ComponentProps<"button">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      {...props}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.8 }}
    />
  );
}
```

## Quality Bar

- Press feedback is immediate.
- The bounce settles quickly enough that the UI still feels fast.
- Text never jitters or blurs from excessive scaling.
- Sibling elements do not jump.
- The same component remains usable with reduced motion.

## Avoid

- Global spring defaults applied to every transition.
- Bounce on text-only content blocks.
- Nested spring animations competing with each other.
- Overshoot that makes a precise UI feel unreliable.

## Sources

- https://motion.dev/docs/react
- https://motion.dev/docs/react-transitions
- https://smoothui.dev/docs/guides/animated-components
