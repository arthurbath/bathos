import AppKit
import Foundation
import WebKit

@MainActor
final class TasksMacKeyboardController: ObservableObject {
    private weak var browserModel: TasksBrowserModel?
    private var keyMonitor: Any?

    func attach(to browserModel: TasksBrowserModel) {
        self.browserModel = browserModel
        guard keyMonitor == nil else {
            return
        }
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) {
            [weak self] event in
            guard let self else {
                return event
            }
            if Self.shouldPerformCacheClearingRefresh(
                charactersIgnoringModifiers: event.charactersIgnoringModifiers,
                modifierFlags: event.modifierFlags,
                isRepeat: event.isARepeat,
                tasksWindowIsKey: self.browserModel?.webView?.window?.isKeyWindow == true
            ) {
                self.browserModel?.reloadClearingCache()
                return nil
            }
            if let destination = Self.destination(
                charactersIgnoringModifiers: event.charactersIgnoringModifiers,
                modifierFlags: event.modifierFlags
            ) {
                self.browserModel?.open(destination.nativeRoute)
                return nil
            }
            guard Self.shouldConsumeEscape(
                keyCode: event.keyCode,
                modifierFlags: event.modifierFlags,
                tasksWindowIsKey: self.browserModel?.webView?.window?.isKeyWindow == true
            ) else {
                return event
            }
            self.forwardEscape()
            return nil
        }
    }

    func stop() {
        if let keyMonitor {
            NSEvent.removeMonitor(keyMonitor)
        }
        keyMonitor = nil
        browserModel = nil
    }

    static func destination(
        charactersIgnoringModifiers: String?,
        modifierFlags: NSEvent.ModifierFlags
    ) -> TasksMacDestination? {
        let taskModifiers = modifierFlags.intersection([
            .command,
            .control,
            .option,
            .shift,
        ])
        guard taskModifiers == [.command],
              let charactersIgnoringModifiers,
              let number = Int(charactersIgnoringModifiers),
              let destination = TasksMacDestination(rawValue: number) else {
            return nil
        }
        return destination
    }

    static func shouldPerformCacheClearingRefresh(
        charactersIgnoringModifiers: String?,
        modifierFlags: NSEvent.ModifierFlags,
        isRepeat: Bool,
        tasksWindowIsKey: Bool
    ) -> Bool {
        guard tasksWindowIsKey,
              !isRepeat,
              charactersIgnoringModifiers?.lowercased() == "r" else {
            return false
        }
        return modifierFlags.intersection([
            .command,
            .control,
            .option,
            .shift,
        ]) == [.command, .option]
    }

    static func shouldConsumeEscape(
        keyCode: UInt16,
        modifierFlags: NSEvent.ModifierFlags,
        tasksWindowIsKey: Bool
    ) -> Bool {
        guard tasksWindowIsKey, keyCode == 53 else {
            return false
        }
        return modifierFlags.intersection([
            .command,
            .control,
            .option,
            .shift,
        ]).isEmpty
    }

    private func forwardEscape() {
        browserModel?.webView?.evaluateJavaScript(Self.escapeJavaScript)
    }

    static let escapeJavaScript = """
    (() => {
      const target = document.activeElement instanceof Element
        ? document.activeElement
        : document.body;
      if (!target) return false;
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    })();
    """
}
