## Context

The floating New Task action currently uses a 56px opaque background, two-pixel green outline, and green icon. The mobile navigation now establishes a lighter persistent-control language through a translucent semantic surface and `backdrop-blur-sm`.

## Goals / Non-Goals

**Goals:**

- Bring the floating action into visual parity with the mobile navigation.
- Keep creation semantically green and the Plus clearly legible.
- Reduce the visible diameter while retaining a touch-safe control.
- Preserve placement, availability, focus treatment, and creation behavior.

**Non-Goals:**

- Changing task-creation defaults or routing.
- Restyling bucket-level creation affordances.
- Introducing gradients, shadows, new color tokens, or a shared floating-action component.

## Decisions

- Use the existing semantic `success` color with alpha rather than a raw green value, so the treatment stays theme-token-driven.
- Use a one-pixel opaque `success` border against a translucent success surface. The shared green hue appears slightly lighter and clearer at the boundary without requiring a new token.
- Use `backdrop-blur-sm` and a slightly more transparent surface when backdrop filters are supported, matching the mobile navigation's progressive enhancement.
- Reduce the button from 56px to 48px. This remains above the 44px touch-target baseline while making the control visibly less dominant.
- Use `success-foreground` for the Plus and retain a 24px icon for immediate recognition.

## Risks / Trade-offs

- **Backdrop blur support varies** → The translucent green surface and border remain legible without blur.
- **A smaller control may be slightly harder to acquire** → Keep a 48px circular hit area and unchanged viewport placement.
- **Content behind the button may influence its appearance** → Use sufficiently high surface opacity and an opaque semantic border to preserve contrast.
