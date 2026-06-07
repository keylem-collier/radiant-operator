# Clean Micro-Animation

## Description

Use this skill when adding subtle frontend micro-interactions: button feedback, hover lift, focus/press states, form validation feedback, menu affordances, loading transitions, toast entrances, and small state changes that should feel premium without calling attention to themselves.

## Current Signals

- Micro-interactions work best when they provide feedback, guide attention, or clarify state.
- The common duration range for small UI feedback is roughly `120ms` to `220ms`; more complex state transitions can stretch toward `300ms`.
- High-performance animation should prefer `transform` and `opacity`.
- Always respect `prefers-reduced-motion`.

## Workflow

1. Identify the functional purpose of the motion: feedback, continuity, hierarchy, status, or delight.
2. Keep the first pass small: one state change, one transform axis, one opacity change, or one scale cue.
3. Use CSS transitions for simple hover/focus/active states.
4. Use Motion for React only when state, layout, gestures, or presence require it.
5. Add reduced-motion behavior before calling the work done.
6. Verify by interacting with the control in a browser and checking mobile width.

## Defaults

```css
.interactive {
  transition:
    transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 160ms ease,
    box-shadow 160ms ease;
}

.interactive:hover {
  transform: translateY(-1px);
}

.interactive:active {
  transform: translateY(0) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .interactive {
    transition-duration: 1ms;
  }

  .interactive:hover,
  .interactive:active {
    transform: none;
  }
}
```

## Quality Bar

- Motion is felt more than noticed.
- No surprise motion on page load unless it improves orientation.
- Keyboard focus is at least as clear as hover.
- Motion never blocks click/tap responsiveness.
- Animations do not cause layout shift.
- Reduced-motion mode keeps the same information available.

## Avoid

- Animating layout properties such as `top`, `left`, `width`, or `height` for routine interactions.
- Long fade-in cascades on operational UI.
- Bouncy effects on destructive, financial, legal, or error states.
- Motion that hides weak hierarchy or unclear copy.

## Sources

- https://www.frontendtools.tech/blog/micro-interactions-ui-ux-guide
- https://web.dev/articles/animations-guide
- https://web.dev/learn/css/animations
