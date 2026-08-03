## Context

`TaskQuickFindDialog` uses one compact panel for an input-only state and for states that add results or feedback beneath the input. The current shared panel spacing leaves a reserved-looking lower region when no secondary content is rendered.

## Goals / Non-Goals

**Goals:**

- Make the input-only palette's bottom inset equal its top inset.
- Keep intentional spacing between the input and any results, loading feedback, error, or no-match message.
- Preserve the current compact width, keyboard behavior, and dismissal behavior.

**Non-Goals:**

- Change search ranking, result content, navigation, or query behavior.
- Redesign Quick Find or alter the full Search page.

## Decisions

Use normal content flow for the panel rather than a reserved minimum height. The panel will own uniform outer padding, while the optional content region will contribute its own top gap only when that region is rendered. This makes the input-only state intrinsically symmetrical and lets result/message states expand only by their actual content.

Alternative considered: apply a negative bottom margin only when the query is empty. This would mask the current symptom but leave loading, error, and no-result states dependent on unrelated fixed-height styling.

Focused component tests will assert the input-only padding contract and the presence of the content gap when secondary content is rendered. Rendered QA will compare an empty query with both a result-bearing and a no-match query.

## Risks / Trade-offs

- [Different feedback states may have different heights] -> Keep a single optional content wrapper with one consistent separation rule and let its children size naturally.
- [Removing reserved space may cause a small intentional resize when typing] -> The resize reflects real content appearing and is preferable to permanent empty padding.
