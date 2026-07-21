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

## Selected-Text Boundary

Two selected-text attempts launched from Codex rejected the request with no task mutation because the command did not observe a fresh nonempty copy from the prepared TextEdit selection. It did not accept the pre-existing clipboard value. This proves the failure boundary but does not prove the ordinary Raycast-hosted success path because macOS Accessibility attributes the synthetic Cmd-C to the launching host.

A real Raycast invocation with a selected front-app value remains required. That acceptance must verify the captured first line, complete notes, `selected_text` provenance, and restoration of the prior plain-text clipboard value after a deliberate copy failure.

## Cleanup State

The two synthetic webpage captures, the Finder capture, and the setup capture were moved through normal recoverable deletion into Tasks Trash. The production Inbox and Today views returned to empty and synchronization reported `Synced`. Permanent removal is pending the required action-time confirmation. No temporary local fixture remains.

## Result

Production browser-page, Finder-item, and reading-item capture pass through OAuth refresh, MCP creation, PowerSync projection, structured source presentation, and recoverable cleanup. Selected-text capture remains an explicit real-Raycast acceptance item rather than an inferred pass.
