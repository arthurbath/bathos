import AppKit
import Carbon
import Foundation
import OSLog
import SwiftUI
import WebKit

@MainActor
final class TasksMacKeyboardController: ObservableObject {
    private weak var browserModel: TasksBrowserModel?
    private var keyMonitor: Any?
    private let shortcutRegistrar = TasksGlobalShortcutRegistrar()
    private lazy var quickEntryPanel = TasksMacQuickEntryPanelController {
        [weak self] committed in
        guard committed, let webView = self?.browserModel?.webView else {
            return
        }
        webView.evaluateJavaScript("""
        window.dispatchEvent(new CustomEvent(
          "bathos:tasks-native-quick-entry-finished",
          { detail: { committed: true } }
        ));
        """)
    }

    func attach(to browserModel: TasksBrowserModel) {
        self.browserModel = browserModel
        browserModel.configureQuickEntryShortcut = { [weak self] shortcut in
            guard let self else {
                return TaskQuickEntryShortcutResponse(
                    success: false,
                    display: nil,
                    message: "The native shortcut recorder is unavailable"
                )
            }
            return self.shortcutRegistrar.configure(shortcut)
        }
        shortcutRegistrar.onTrigger = { [weak self] in
            self?.quickEntryPanel.show()
        }
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
        shortcutRegistrar.onTrigger = nil
        browserModel?.configureQuickEntryShortcut = nil
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

struct TasksGlobalShortcutStore {
    private static let storageKey = "tasksGlobalQuickEntryShortcut"

    static func load(
        defaults: UserDefaults = .standard
    ) -> TaskQuickEntryShortcutPayload? {
        guard let data = defaults.data(forKey: storageKey) else {
            return nil
        }
        return try? JSONDecoder().decode(
            TaskQuickEntryShortcutPayload.self,
            from: data
        )
    }

    static func save(
        _ shortcut: TaskQuickEntryShortcutPayload,
        defaults: UserDefaults = .standard
    ) {
        guard let data = try? JSONEncoder().encode(shortcut) else {
            return
        }
        defaults.set(data, forKey: storageKey)
    }

    static func display(
        _ shortcut: TaskQuickEntryShortcutPayload?
    ) -> String? {
        guard let shortcut,
              let key = TasksGlobalShortcutKeyMap.label(for: shortcut.code)
        else {
            return nil
        }
        var display = ""
        if shortcut.control { display += "⌃" }
        if shortcut.option { display += "⌥" }
        if shortcut.shift { display += "⇧" }
        if shortcut.command { display += "⌘" }
        return display + key
    }
}

enum TasksGlobalShortcutKeyMap {
    private static let keyCodes: [String: UInt32] = [
        "KeyA": 0, "KeyS": 1, "KeyD": 2, "KeyF": 3,
        "KeyH": 4, "KeyG": 5, "KeyZ": 6, "KeyX": 7,
        "KeyC": 8, "KeyV": 9, "KeyB": 11, "KeyQ": 12,
        "KeyW": 13, "KeyE": 14, "KeyR": 15, "KeyY": 16,
        "KeyT": 17, "Digit1": 18, "Digit2": 19, "Digit3": 20,
        "Digit4": 21, "Digit6": 22, "Digit5": 23, "Equal": 24,
        "Digit9": 25, "Digit7": 26, "Minus": 27, "Digit8": 28,
        "Digit0": 29, "BracketRight": 30, "KeyO": 31, "KeyU": 32,
        "BracketLeft": 33, "KeyI": 34, "KeyP": 35, "KeyL": 37,
        "KeyJ": 38, "Quote": 39, "KeyK": 40, "Semicolon": 41,
        "Backslash": 42, "Comma": 43, "Slash": 44, "KeyN": 45,
        "KeyM": 46, "Period": 47, "Space": 49, "Backquote": 50,
        "F1": 122, "F2": 120, "F3": 99, "F4": 118,
        "F5": 96, "F6": 97, "F7": 98, "F8": 100,
        "F9": 101, "F10": 109, "F11": 103, "F12": 111,
    ]

    static func keyCode(for code: String) -> UInt32? {
        keyCodes[code]
    }

    static func label(for code: String) -> String? {
        if code.hasPrefix("Key"), code.count == 4 {
            return String(code.suffix(1))
        }
        if code.hasPrefix("Digit"), code.count == 6 {
            return String(code.suffix(1))
        }
        let labels: [String: String] = [
            "Equal": "=", "Minus": "-", "BracketRight": "]",
            "BracketLeft": "[", "Quote": "'", "Semicolon": ";",
            "Backslash": "\\", "Comma": ",", "Slash": "/",
            "Period": ".", "Space": "Space", "Backquote": "`",
        ]
        return labels[code] ?? (code.hasPrefix("F") ? code : nil)
    }
}

@MainActor
final class TasksGlobalShortcutRegistrar {
    typealias RegisterHotKey = (
        UInt32,
        UInt32,
        EventHotKeyID,
        UnsafeMutablePointer<EventHotKeyRef?>
    ) -> OSStatus
    typealias UnregisterHotKey = (EventHotKeyRef) -> OSStatus

    private static let signature: OSType = 0x4254534B
    private static let logger = Logger(
        subsystem: "garden.bath.tasks",
        category: "GlobalQuickEntry"
    )
    private var eventHandler: EventHandlerRef?
    private var hotKey: EventHotKeyRef?
    private var activeShortcut: TaskQuickEntryShortcutPayload?
    private var nextIdentifier: UInt32 = 1
    private let defaults: UserDefaults
    private let registerHotKey: RegisterHotKey
    private let unregisterHotKey: UnregisterHotKey
    var onTrigger: (() -> Void)?

    init(
        defaults: UserDefaults = .standard,
        installEventHandler: Bool = true,
        registerHotKey: @escaping RegisterHotKey = {
            keyCode,
            modifiers,
            identifier,
            candidate in
            RegisterEventHotKey(
                keyCode,
                modifiers,
                identifier,
                GetApplicationEventTarget(),
                0,
                candidate
            )
        },
        unregisterHotKey: @escaping UnregisterHotKey = {
            UnregisterEventHotKey($0)
        }
    ) {
        self.defaults = defaults
        self.registerHotKey = registerHotKey
        self.unregisterHotKey = unregisterHotKey
        if installEventHandler {
            var eventType = EventTypeSpec(
                eventClass: OSType(kEventClassKeyboard),
                eventKind: UInt32(kEventHotKeyPressed)
            )
            InstallEventHandler(
                GetApplicationEventTarget(),
                tasksGlobalQuickEntryHotKeyHandler,
                1,
                &eventType,
                Unmanaged.passUnretained(self).toOpaque(),
                &eventHandler
            )
        }
        if let stored = TasksGlobalShortcutStore.load(defaults: defaults) {
            _ = register(stored, persist: false)
        }
    }

    deinit {
        if let hotKey {
            _ = unregisterHotKey(hotKey)
        }
        if let eventHandler {
            RemoveEventHandler(eventHandler)
        }
    }

    func configure(
        _ shortcut: TaskQuickEntryShortcutPayload
    ) -> TaskQuickEntryShortcutResponse {
        register(shortcut, persist: true)
    }

    func trigger() {
        onTrigger?()
    }

    private func register(
        _ shortcut: TaskQuickEntryShortcutPayload,
        persist: Bool
    ) -> TaskQuickEntryShortcutResponse {
        guard shortcut.command || shortcut.control || shortcut.option else {
            return failure(
                "Include Command, Control, or Option in the shortcut",
                diagnostic: "missing required modifier"
            )
        }
        guard let keyCode = TasksGlobalShortcutKeyMap.keyCode(
            for: shortcut.code
        ), let display = TasksGlobalShortcutStore.display(shortcut) else {
            return failure(
                "That key is not supported for Global Quick Entry",
                diagnostic: "unsupported key code \(shortcut.code)"
            )
        }
        if shortcut == activeShortcut {
            return TaskQuickEntryShortcutResponse(
                success: true,
                display: display,
                message: nil
            )
        }

        var modifiers: UInt32 = 0
        if shortcut.command { modifiers |= UInt32(cmdKey) }
        if shortcut.control { modifiers |= UInt32(controlKey) }
        if shortcut.option { modifiers |= UInt32(optionKey) }
        if shortcut.shift { modifiers |= UInt32(shiftKey) }

        var candidate: EventHotKeyRef?
        let identifier = nextIdentifier
        nextIdentifier &+= 1
        let status = registerHotKey(
            keyCode,
            modifiers,
            EventHotKeyID(
                signature: Self.signature,
                id: identifier
            ),
            &candidate
        )
        guard status == noErr, let candidate else {
            return failure(
                "That shortcut is reserved or already used by another application",
                diagnostic: "registration failed with OSStatus \(status)"
            )
        }

        if let hotKey {
            _ = unregisterHotKey(hotKey)
        }
        hotKey = candidate
        activeShortcut = shortcut
        if persist {
            TasksGlobalShortcutStore.save(shortcut, defaults: defaults)
        }
        return TaskQuickEntryShortcutResponse(
            success: true,
            display: display,
            message: nil
        )
    }

    private func failure(
        _ message: String,
        diagnostic: String
    ) -> TaskQuickEntryShortcutResponse {
        Self.logger.error("\(diagnostic, privacy: .public)")
        return TaskQuickEntryShortcutResponse(
            success: false,
            display: TasksGlobalShortcutStore.display(activeShortcut),
            message: message
        )
    }
}

private func tasksGlobalQuickEntryHotKeyHandler(
    _ nextHandler: EventHandlerCallRef?,
    _ event: EventRef?,
    _ userData: UnsafeMutableRawPointer?
) -> OSStatus {
    guard let userData else {
        return OSStatus(eventNotHandledErr)
    }
    let registrar = Unmanaged<TasksGlobalShortcutRegistrar>
        .fromOpaque(userData)
        .takeUnretainedValue()
    Task { @MainActor in
        registrar.trigger()
    }
    return noErr
}

@MainActor
final class TasksMacQuickEntryPanelController: NSObject {
    private let onFinish: (Bool) -> Void
    private let browserModel = TasksBrowserModel()
    private lazy var panel: TasksMacQuickEntryPanel = makePanel()

    init(onFinish: @escaping (Bool) -> Void) {
        self.onFinish = onFinish
        super.init()
        browserModel.quickEntryDidFinish = { [weak self] committed in
            guard let self else {
                return
            }
            self.panel.orderOut(nil)
            self.onFinish(committed)
        }
    }

    func show() {
        browserModel.openWebURL(TasksMacQuickEntryPanelPolicy.webURL)
        TasksMacQuickEntryPanelPolicy.apply(to: panel)
        panel.center()
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
    }

    private func makePanel() -> TasksMacQuickEntryPanel {
        let panel = TasksMacQuickEntryPanel(
            contentRect: NSRect(
                origin: .zero,
                size: TasksMacQuickEntryPanelPolicy.contentSize
            ),
            styleMask: [.titled, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isMovableByWindowBackground = true
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.collectionBehavior =
            TasksMacQuickEntryPanelPolicy.collectionBehavior
        panel.backgroundColor = TasksMacAppearance.applicationBackground
        panel.contentViewController = NSHostingController(
            rootView: TasksMacWebView(model: browserModel)
        )
        TasksMacQuickEntryPanelPolicy.apply(to: panel)
        return panel
    }
}

enum TasksMacQuickEntryPanelPolicy {
    static let contentSize = NSSize(width: 560, height: 680)
    static let collectionBehavior: NSWindow.CollectionBehavior = [
        .canJoinAllSpaces,
        .fullScreenAuxiliary,
        .transient,
    ]

    static func apply(to panel: NSPanel) {
        panel.contentMinSize = contentSize
        panel.contentMaxSize = contentSize
        panel.setContentSize(contentSize)
    }

    static let webURL = URL(
        string: "https://\(TaskCompanionConstants.trustedWebHost)"
            + "/tasks/today?native_new_task=1&native_quick_entry=1"
    )!
}

final class TasksMacQuickEntryPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
