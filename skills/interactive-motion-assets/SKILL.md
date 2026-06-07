# Interactive Motion Assets

## Description

Use this skill when frontend UI needs authored motion assets rather than code-only transitions: animated icons, onboarding illustrations, empty states, hero characters, product explainers, success/failure indicators, or brand motion systems.

## Current Signals

- Rive is a strong fit for interactive, stateful, reusable animations with a web runtime.
- Lottie is a strong fit for lightweight vector animation playback across web and mobile.
- Code-only motion is better for layout, state, and direct UI feedback; authored assets are better for expressive illustration and brand moments.

## Workflow

1. Decide whether the motion is UI behavior or an authored asset.
2. Use code motion for direct manipulation, layout, and interaction feedback.
3. Use Rive when animation has interactive states, inputs, or reusable state machines.
4. Use Lottie when the animation is mostly linear playback or icon/illustration motion.
5. Keep asset dimensions stable with `aspect-ratio`, fixed bounds, or container constraints.
6. Lazy-load large assets below the first viewport.
7. Provide static fallback or reduced-motion fallback.

## Selection Guide

- `Motion/CSS`: buttons, cards, tabs, layout shifts, drawers, modals.
- `GSAP`: timelines, scroll choreography, elaborate sequencing.
- `Rive`: interactive illustrations, state machines, animated controls, game-like UI.
- `Lottie`: animated icons, loaders, success states, short vector loops.

## Integration Notes

- Keep interactive assets outside core navigation if failure would block the app.
- Avoid infinite loops near reading-heavy content.
- Use short loops with idle pauses for brand motion.
- Compress and cache assets.
- Verify asset rendering in browser. Broken animation files often fail quietly.

## Quality Bar

- Asset motion has a role: explain, reward, indicate progress, or reinforce brand.
- It does not compete with primary UI controls.
- The fallback state still looks intentional.
- Reduced-motion users are not forced through continuous movement.

## Avoid

- Using Lottie/Rive for ordinary hover states.
- Decorative loops that distract from forms or dashboards.
- Full-viewport animation assets without loading and fallback handling.
- Multiple animation systems all driving the same element.

## Sources

- https://rive.app/docs/runtimes/web
- https://rive.app/docs
- https://docs.lottiefiles.com/en
- https://lottiefiles.github.io/lottie-docs/advanced_interactions/
