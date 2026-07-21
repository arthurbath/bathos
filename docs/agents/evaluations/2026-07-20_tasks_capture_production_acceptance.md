# Tasks Capture Production Acceptance

Date: 2026 Jul 20

## Purpose

Validate the implemented macOS capture surfaces through their real production boundary rather than treating isolated command tests as proof. The exercise used a public synthetic webpage, uniquely named temporary files, the existing Raycast OAuth grant, the production BathOS MCP function, PowerSync, and Safari. It did not write to Things or enable Inbox Manager Mail delivery.

## Accepted Paths

### Browser Page

The active Safari tab exposed a unique `example.com` URL and the ordinary `Example Domain` browser title. `Add Page to Tasks` created exactly one Inbox to-do with `browser_capture` entry provenance and a typed `webpage` source. The synchronized Inbox presented a real `Open Webpage` link whose target preserved the exact query-bearing source URL.

### Finder Item

Finder selected exactly one uniquely named temporary text file. `Add Finder Item to Tasks` created exactly one Inbox to-do with `raycast` entry provenance and a typed `file` source. The synchronized Inbox presented a real `Open File` link whose target preserved the encoded local `file://` reference. The temporary file was removed after verification.

### Reading Item

The verified active Safari tab exposed a second unique `example.com` URL. The existing Inbox Manager preparation helper returned a bounded AI-refined title, and `Add to Tasks Reading List` created exactly one daytime Today to-do with `browser_capture` entry provenance and a typed `reading_item` source. The synchronized Today view presented a real `Open Reading Item` link whose target preserved the exact source URL and whose accessible help retained the deterministic browser title.

One setup run captured the user's actual active Safari tab before the synthetic tab was deliberately selected. That behavior matched the command contract and was not a title-generation defect. The resulting setup capture was moved to Trash without recording its private browsing context in this repository.

## Retired Path

Two selected-text attempts launched from Codex rejected the request without creating a task because the command did not observe a fresh nonempty copy from the prepared TextEdit selection. A later real-Raycast exercise also created no task. Raycast remained the frontmost application while its Script Command ran, so Cmd-C could not dependably reach the originating TextEdit selection.

Raycast exposes reliable selected-text retrieval to full extensions, but this workflow does not occur often enough in the user's current practice to justify a separate extension. The selected-text command, its focused tests, its guide registration, and its live acceptance obligation were removed. A later change may reconsider the surface only after a recurring use case establishes its value.

## Cleanup State

The two synthetic webpage captures, the Finder capture, and the setup capture were moved through normal recoverable deletion into Tasks Trash. The production Inbox and Today views returned to empty and synchronization reported `Synced`. Permanent removal is pending the required action-time confirmation. No temporary local fixture remains.

## Result

Production browser-page, Finder-item, and reading-item capture pass through OAuth refresh, MCP creation, PowerSync projection, structured source presentation, and recoverable cleanup. Selected-text capture is not part of the current product contract.

## Sources

- [Raycast Environment API](https://developers.raycast.com/api-reference/environment) documents `getSelectedText` for extension commands.
- [Raycast Script Commands](https://manual.raycast.com/script-commands) documents the separate Script Command surface used by the retired implementation.
