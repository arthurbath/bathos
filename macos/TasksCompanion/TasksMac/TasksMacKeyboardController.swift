import AppKit
import Carbon
import Foundation
import OSLog
import SwiftUI
import WebKit
import WidgetKit

@MainActor
final class TasksMacKeyboardController: ObservableObject {
    private weak var browserModel: TasksBrowserModel?
    private var keyMonitor: Any?
    private var didProcessDebugQuickEntryLaunch = false
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
        browserModel.clearQuickEntryShortcut = { [weak self] in
            guard let self else {
                return TaskQuickEntryShortcutResponse(
                    success: false,
                    display: nil,
                    message: "The native shortcut recorder is unavailable"
                )
            }
            return self.shortcutRegistrar.clear()
        }
        shortcutRegistrar.onTrigger = { [weak self] in
            self?.quickEntryPanel.toggle()
        }
#if DEBUG
        if !didProcessDebugQuickEntryLaunch {
            didProcessDebugQuickEntryLaunch = true
            if ProcessInfo.processInfo.environment[
                "TASKS_SHOW_NATIVE_QUICK_ENTRY_ON_LAUNCH"
            ] == "1" {
                DispatchQueue.main.async { [weak self] in
                    self?.quickEntryPanel.show()
                }
            }
        }
#endif
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
        browserModel?.clearQuickEntryShortcut = nil
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
              let charactersIgnoringModifiers else {
            return nil
        }

        if charactersIgnoringModifiers == "," {
            return .settings
        }

        guard let number = Int(charactersIgnoringModifiers),
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

    static func clear(defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: storageKey)
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

    func clear() -> TaskQuickEntryShortcutResponse {
        if let hotKey {
            _ = unregisterHotKey(hotKey)
        }
        hotKey = nil
        activeShortcut = nil
        TasksGlobalShortcutStore.clear(defaults: defaults)
        return TaskQuickEntryShortcutResponse(
            success: true,
            display: nil,
            message: nil
        )
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
    private lazy var nativeService = TasksNativeQuickEntryService()
    private lazy var panel: TasksMacQuickEntryPanel = makePanel()
    private lazy var nativeViewModel = TasksNativeQuickEntryViewModel(
        submitHandler: { [weak self] submission in
            guard let self else {
                throw TasksNativeQuickEntryServiceFailure.unavailable
            }
            return try await self.nativeService.create(submission)
        },
        onCancel: { [weak self] in
            self?.requestCancellation()
        },
        onAccepted: { [weak self] _ in
            guard let self else { return }
            self.nativeBootstrapTask?.cancel()
            self.nativeBootstrapTask = nil
            self.panel.orderOut(nil)
            WidgetCenter.shared.reloadTimelines(
                ofKind: TaskCompanionConstants.widgetKind
            )
            self.onFinish(true)
            self.restorePreviouslyActiveApplication()
        }
    )
    private var cancellationPending = false
    private var nativeBootstrapTask: Task<Void, Never>?
    private var previouslyActiveApplication: NSRunningApplication?

    init(onFinish: @escaping (Bool) -> Void) {
        self.onFinish = onFinish
        super.init()
    }

    func toggle() {
        if panel.isVisible {
            requestCancellation()
        } else {
            show()
        }
    }

    func show() {
        cancellationPending = false
        previouslyActiveApplication = TasksMacQuickEntryPanelPolicy.applicationToRestore(
            frontmostApplication: NSWorkspace.shared.frontmostApplication,
            currentApplication: NSRunningApplication.current
        )
        nativeBootstrapTask?.cancel()
        nativeViewModel.reset(using: nativeService.cachedBootstrap())
        nativeViewModel.beginBootstrapRefresh()
        nativeBootstrapTask = Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let bootstrap = try await nativeService.refreshBootstrap()
                guard !Task.isCancelled else { return }
                nativeViewModel.finishBootstrapRefresh(.success(bootstrap))
            } catch {
                guard !Task.isCancelled else { return }
                nativeViewModel.finishBootstrapRefresh(.failure(error))
            }
        }
        TasksMacQuickEntryPanelPolicy.apply(to: panel)
        TasksMacQuickEntryPanelPolicy.place(
            panel,
            pointerLocation: NSEvent.mouseLocation,
            screens: NSScreen.screens
        )
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
    }

    private func makePanel() -> TasksMacQuickEntryPanel {
        let panel = TasksMacQuickEntryPanel(
            contentRect: NSRect(
                origin: .zero,
                size: TasksMacQuickEntryPanelPolicy.contentSize
            ),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        panel.onCancel = { [weak self] in
            self?.requestCancellation()
        }
        panel.onControlShortcut = { [weak self] key in
            guard let self else {
                return
            }
            let shouldMoveInsertionBoundary =
                self.nativeViewModel.handleControlShortcut(key)
            if shouldMoveInsertionBoundary {
                self.panel.moveTextInsertionToOppositeBoundary()
            }
        }
        panel.onTabTraversal = { [weak self] reverse in
            guard let self else {
                return false
            }
            self.nativeViewModel.moveFocus(reverse: reverse)
            return true
        }
        panel.isMovableByWindowBackground = true
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.collectionBehavior =
            TasksMacQuickEntryPanelPolicy.collectionBehavior
        panel.backgroundColor = .clear
        panel.contentViewController = NSHostingController(
            rootView: TasksMacQuickEntryPanelContent(
                nativeModel: nativeViewModel
            )
        )
        TasksMacQuickEntryPanelPolicy.apply(to: panel)
        return panel
    }

    private func requestCancellation() {
        guard panel.isVisible, !cancellationPending else {
            return
        }
        cancellationPending = true
        nativeBootstrapTask?.cancel()
        nativeBootstrapTask = nil
        panel.orderOut(nil)
        cancellationPending = false
        onFinish(false)
        restorePreviouslyActiveApplication()
    }

    private func restorePreviouslyActiveApplication() {
        let application = previouslyActiveApplication
        previouslyActiveApplication = nil
        guard let application, !application.isTerminated else {
            return
        }
        DispatchQueue.main.async {
            application.activate(options: [])
        }
    }
}

private struct TasksMacQuickEntryPanelContent: View {
    @ObservedObject var nativeModel: TasksNativeQuickEntryViewModel

    var body: some View {
        ZStack(alignment: .top) {
            TasksNativeQuickEntryView(model: nativeModel)
                .id(nativeModel.draft.clientMutationID)

            HStack(spacing: 0) {
                Color.clear
                    .frame(width: 52)
                    .allowsHitTesting(false)
                TasksMacQuickEntryDragRegion()
                Color.clear
                    .frame(width: 52)
                    .allowsHitTesting(false)
            }
            .frame(maxWidth: .infinity)
            .frame(height: TasksMacQuickEntryPanelPolicy.dragRegionHeight)
            .accessibilityHidden(true)
        }
    }
}

private struct TasksMacQuickEntryDragRegion: NSViewRepresentable {
    func makeNSView(context: Context) -> TasksMacQuickEntryDragView {
        TasksMacQuickEntryDragView()
    }

    func updateNSView(
        _ nsView: TasksMacQuickEntryDragView,
        context: Context
    ) {}
}

final class TasksMacQuickEntryDragView: NSView {
    typealias WindowDragPerformer = (NSWindow, NSEvent) -> Void

    private let windowDragPerformer: WindowDragPerformer

    init(
        windowDragPerformer: @escaping WindowDragPerformer = { window, event in
            window.performDrag(with: event)
        }
    ) {
        self.windowDragPerformer = windowDragPerformer
        super.init(frame: .zero)
    }

    required init?(coder: NSCoder) {
        self.windowDragPerformer = { window, event in
            window.performDrag(with: event)
        }
        super.init(coder: coder)
    }

    override var mouseDownCanMoveWindow: Bool { false }

    override func mouseDown(with event: NSEvent) {
        guard let window else {
            return
        }
        windowDragPerformer(window, event)
    }
}

enum TasksMacQuickEntryPanelPolicy {
    static let contentSize = NSSize(width: 520, height: 560)
    static let cornerRadius: CGFloat = 18
    static let borderWidth: CGFloat = 1
    static let borderColor = NSColor(calibratedWhite: 0.20, alpha: 1)
    static let dragRegionHeight: CGFloat = 44
    static let collectionBehavior: NSWindow.CollectionBehavior = [
        .canJoinAllSpaces,
        .fullScreenAuxiliary,
        .transient,
    ]

    static func apply(to panel: NSPanel) {
        panel.contentMinSize = contentSize
        panel.contentMaxSize = contentSize
        panel.setContentSize(contentSize)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.contentView?.wantsLayer = true
        guard let layer = panel.contentView?.layer else {
            return
        }
        layer.backgroundColor = TasksMacAppearance.applicationBackground.cgColor
        layer.cornerRadius = cornerRadius
        layer.cornerCurve = .continuous
        layer.borderWidth = borderWidth
        layer.borderColor = borderColor.cgColor
        layer.masksToBounds = true
    }

    static func place(
        _ panel: NSPanel,
        pointerLocation: NSPoint,
        screens: [NSScreen]
    ) {
        guard let frame = targetScreenFrame(
            pointerLocation: pointerLocation,
            screenFrames: screens.map(\.visibleFrame)
        ) else {
            panel.center()
            return
        }
        panel.setFrameOrigin(centeredOrigin(panelSize: panel.frame.size, in: frame))
    }

    static func targetScreenFrame(
        pointerLocation: NSPoint,
        screenFrames: [NSRect]
    ) -> NSRect? {
        screenFrames.first(where: { $0.contains(pointerLocation) })
            ?? screenFrames.first
    }

    static func centeredOrigin(panelSize: NSSize, in screenFrame: NSRect) -> NSPoint {
        NSPoint(
            x: screenFrame.midX - panelSize.width / 2,
            y: screenFrame.midY - panelSize.height / 2
        )
    }

    static func applicationToRestore(
        frontmostApplication: NSRunningApplication?,
        currentApplication: NSRunningApplication
    ) -> NSRunningApplication? {
        guard frontmostApplication?.processIdentifier != currentApplication.processIdentifier else {
            return nil
        }
        return frontmostApplication
    }

}

enum TasksMacQuickEntryControlShortcutAction: Equatable {
    case forward(String)
    case consume
    case passThrough
}

enum TasksMacQuickEntryControlShortcutPolicy {
    private static let metadataKeys: Set<String> = [
        "e", "r", "t", "y", "n", "d", "f", "g", "h", "c", "v",
    ]
    private static let excludedTaskKeys: Set<String> = [
        "q", "w", "a", "s", "z", "x", "b",
        "1", "2", "3", "4", "5", "6",
    ]

    static func action(
        charactersIgnoringModifiers: String?,
        modifierFlags: NSEvent.ModifierFlags
    ) -> TasksMacQuickEntryControlShortcutAction {
        let commandModifiers = modifierFlags.intersection([
            .command,
            .control,
            .option,
            .shift,
        ])
        guard commandModifiers == [.control],
              let key = charactersIgnoringModifiers?.lowercased() else {
            return .passThrough
        }
        if metadataKeys.contains(key) {
            return .forward(key)
        }
        if excludedTaskKeys.contains(key) {
            return .consume
        }
        return .passThrough
    }

}

final class TasksMacQuickEntryPanel: NSPanel {
    var onCancel: (() -> Void)?
    var onControlShortcut: ((String) -> Void)?
    var onTabTraversal: ((Bool) -> Bool)?

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    override func sendEvent(_ event: NSEvent) {
        if event.type == .keyDown {
            if event.keyCode == 48 {
                let modifiers = event.modifierFlags.intersection([
                    .command,
                    .control,
                    .option,
                    .shift,
                ])
                if modifiers.isEmpty || modifiers == [.shift],
                   onTabTraversal?(modifiers == [.shift]) == true {
                    return
                }
            }
            switch TasksMacQuickEntryControlShortcutPolicy.action(
                charactersIgnoringModifiers: event.charactersIgnoringModifiers,
                modifierFlags: event.modifierFlags
            ) {
            case let .forward(key):
                onControlShortcut?(key)
                return
            case .consume:
                return
            case .passThrough:
                break
            }
        }
        super.sendEvent(event)
    }

    override func cancelOperation(_ sender: Any?) {
        onCancel?()
    }

    func moveTextInsertionToOppositeBoundary() {
        guard let editor = firstResponder as? NSTextView else {
            return
        }
        let length = editor.string.utf16.count
        let selection = editor.selectedRange()
        let destination = selection.length == 0 && selection.location >= length
            ? 0
            : length
        let range = NSRange(location: destination, length: 0)
        editor.setSelectedRange(range)
        editor.scrollRangeToVisible(range)
    }
}
