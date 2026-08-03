## Context

The Tasks shell owns Control-key commands, while each open task row owns the unified Start picker and its internal focus model. Control+T currently updates planning through the shell, so an already-open picker can show the new value without receiving a corresponding focus instruction.

## Goals / Non-Goals

**Goals:**

- Synchronize an open Start picker's keyboard focus with the Today horizon assigned by Control+T.
- Preserve Control+T as a direct command that does not open a closed picker.
- Keep pointer, Space, Return, and ordinary picker navigation unchanged.

**Non-Goals:**

- Changing Control+T's existing Today-horizon assignment rules.
- Changing other Start commands or opening the picker from Control+T.
- Changing persistence, data models, or native companion behavior.

## Decisions

- Represent the focus handoff as transient row-level command state keyed by task and the assigned Today horizon. This keeps persistence in the existing command path and lets only an already-mounted Start picker consume the request.
- Have the Start picker acknowledge the request after focusing the matching horizon control. This prevents a stale request from overriding later manual focus movement.
- Do not use the task's persisted value alone as a focus trigger. Persistence can update for many reasons, and reacting to every update would unexpectedly move focus during ordinary picker use.

## Risks / Trade-offs

- [Risk] Autosave projection may render after the focus request. -> Match the request to the command's assigned horizon and consume it from the mounted picker after React renders.
- [Risk] A retained request could affect a picker opened later. -> Clear or acknowledge the request even when no picker is open, and test that Control+T leaves a closed picker closed.
