## Context

BathOS mounts two global notification renderers: the Radix-based application toaster and Sonner for network/system errors. The Radix viewport currently changes from top on narrow screens to bottom-right on wider screens, while Sonner uses its library default. The shared floating mobile navigation is fixed above the device safe area with a platform CSS variable and a `z-40` layer.

## Goals / Non-Goals

**Goals:**

- Give both toast systems one bottom-origin responsive placement model.
- Keep mobile toasts above the floating navigation footprint without layering them over the navigation.
- Align desktop toasts with the inner right edge of the shared `max-w-5xl` content frame.
- Reduce toast padding without changing message content or duration behavior.

**Non-Goals:**

- Changing toast copy, variants, duration calculations, queuing, or dismissal semantics.
- Changing the mobile navigation position or size.
- Replacing either toast library.

## Decisions

1. **Use one shared geometry contract expressed through platform CSS variables and renderer props.** The Radix viewport will use shared classes and the existing mobile-navigation offset variable. Sonner will receive explicit bottom-right placement and matching desktop/mobile offsets. This avoids module-specific positioning and keeps both global renderers synchronized.

2. **Reserve the layer immediately below mobile navigation.** Toast stacks will use `z-35`, below the navigation's `z-40` and above ordinary list controls. Sonner's library-level high z-index will be overridden by a shared class because otherwise its notifications would cover navigation despite correct physical clearance.

3. **Anchor desktop notifications to the inner edge of the standard content frame.** The desktop right offset will be the larger of the normal page gutter and the centered `max-w-5xl` outer margin plus its inner gutter. This follows the existing shared layout rather than tying notifications to any one module.

4. **Use bottom-origin motion and compact shared padding.** Radix toasts will enter from and leave toward the bottom, and both systems will use twelve-pixel base padding with extra right clearance only where the close control requires it. Existing reduced-motion behavior remains authoritative.

## Risks / Trade-offs

- **A module may use a narrower form width than the shared content frame** -> Toasts intentionally align to the platform maximum content frame for stable cross-view placement rather than moving horizontally between pages.
- **A very tall stack may compete with mobile content above the navigation** -> Preserve the existing bounded stack behavior and viewport height while moving its origin, so notifications remain dismissible and do not cover the navigation.
- **Sonner library styles may override shared spacing or z-index** -> Use an explicit semantic toaster class and important utility declarations only for library-owned declarations that must be normalized.

## Migration Plan

Ship as a backward-compatible shared UI update with focused renderer tests and rendered responsive verification. Rollback consists of reverting the shared toast primitive, Sonner props/classes, and associated CSS without data migration.

## Open Questions

None.
