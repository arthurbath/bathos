import AppKit
import Carbon
import SwiftUI
import WebKit
import XCTest
@testable import TasksMac

@MainActor
final class TasksMacTests: XCTestCase {
    func testWebViewAcceptsTheFirstMouseEventFromAnInactiveWindow() {
        let webView = TasksFirstMouseWebView(
            frame: .zero,
            configuration: WKWebViewConfiguration()
        )

        XCTAssertTrue(webView.acceptsFirstMouse(for: nil))
    }

    func testMacWidgetUsesCompactTenRowDensity() {
        XCTAssertEqual(
            TaskWidgetPresentationPolicy.largeWidgetTaskRowMinimumHeight,
            28
        )
    }

    func testWindowPolicySupportsNarrowSplitViewPlacement() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1_100, height: 780),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.collectionBehavior = [
            .fullScreenNone,
            .fullScreenDisallowsTiling,
        ]

        TasksMacWindowPolicy.apply(to: window)

        XCTAssertEqual(TasksMacWindowPolicy.minimumSize.width, 360)
        XCTAssertEqual(TasksMacWindowPolicy.minimumSize.height, 420)
        XCTAssertTrue(window.styleMask.contains(.resizable))
        XCTAssertTrue(window.collectionBehavior.contains(.fullScreenPrimary))
        XCTAssertTrue(window.collectionBehavior.contains(.fullScreenAllowsTiling))
        XCTAssertFalse(window.collectionBehavior.contains(.fullScreenNone))
        XCTAssertFalse(window.collectionBehavior.contains(.fullScreenDisallowsTiling))
        XCTAssertEqual(window.minSize, TasksMacWindowPolicy.minimumSize)
    }

    func testWindowPolicyObserverRestoresSplitViewEligibilityAfterTransition() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1_100, height: 780),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        let observer = TasksMacWindowPolicyObserver()
        observer.attach(to: window)

        window.styleMask.remove(.resizable)
        window.collectionBehavior.remove(.fullScreenPrimary)
        window.collectionBehavior.remove(.fullScreenAllowsTiling)
        window.collectionBehavior.insert(.fullScreenDisallowsTiling)
        window.minSize = NSSize(width: 900, height: 700)

        NotificationCenter.default.post(
            name: NSWindow.didExitFullScreenNotification,
            object: window
        )

        XCTAssertTrue(window.styleMask.contains(.resizable))
        XCTAssertTrue(window.collectionBehavior.contains(.fullScreenPrimary))
        XCTAssertTrue(window.collectionBehavior.contains(.fullScreenAllowsTiling))
        XCTAssertFalse(window.collectionBehavior.contains(.fullScreenDisallowsTiling))
        XCTAssertEqual(window.minSize, TasksMacWindowPolicy.minimumSize)

        observer.stopObserving()
    }

    func testMacHostUsesTheUnifiedTasksIdentity() {
        XCTAssertEqual(Bundle.main.bundleIdentifier, "garden.bath.tasks")
        XCTAssertEqual(
            Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String,
            "Tasks"
        )
        XCTAssertEqual(TaskCompanionConstants.appGroupIdentifier, "group.garden.bath.tasks")
        XCTAssertEqual(TaskCompanionConstants.widgetKind, "garden.bath.tasks.list-widget")
    }

    func testMacHostEmbedsTheUnifiedTasksWidgetExtension() throws {
        let widgetURL = try XCTUnwrap(
            Bundle.main.builtInPlugInsURL?
                .appendingPathComponent("TasksMacWidgets.appex")
        )
        let widgetBundle = try XCTUnwrap(Bundle(url: widgetURL))
        let extensionAttributes = try XCTUnwrap(
            widgetBundle.object(forInfoDictionaryKey: "NSExtension")
                as? [String: Any]
        )

        XCTAssertTrue(FileManager.default.fileExists(atPath: widgetURL.path))
        XCTAssertEqual(widgetBundle.bundleIdentifier, "garden.bath.tasks.widgets")
        XCTAssertEqual(
            extensionAttributes["NSExtensionPointIdentifier"] as? String,
            "com.apple.widgetkit-extension"
        )
    }

    func testMacHostUsesTheCompiledModernAppIcon() {
        XCTAssertEqual(
            Bundle.main.object(forInfoDictionaryKey: "CFBundleIconName") as? String,
            "Tasks Apple Native Icon"
        )
        XCTAssertNotNil(
            Bundle.main.url(
                forResource: "Tasks Apple Native Icon",
                withExtension: "icns"
            )
        )
    }

    func testCommandNumberDestinations() {
        for destination in TasksMacDestination.allCases {
            XCTAssertEqual(
                TasksMacKeyboardController.destination(
                    charactersIgnoringModifiers: String(destination.rawValue),
                    modifierFlags: [.command]
                ),
                destination
            )
        }
        XCTAssertNil(TasksMacKeyboardController.destination(
            charactersIgnoringModifiers: "1",
            modifierFlags: [.control]
        ))
        XCTAssertNil(TasksMacKeyboardController.destination(
            charactersIgnoringModifiers: "7",
            modifierFlags: [.command]
        ))
    }

    func testCommandCommaOpensSettings() {
        XCTAssertEqual(
            TasksMacKeyboardController.destination(
                charactersIgnoringModifiers: ",",
                modifierFlags: [.command]
            ),
            .settings
        )
        XCTAssertNil(TasksMacKeyboardController.destination(
            charactersIgnoringModifiers: ",",
            modifierFlags: []
        ))
        XCTAssertNil(TasksMacKeyboardController.destination(
            charactersIgnoringModifiers: ",",
            modifierFlags: [.command, .shift]
        ))
        XCTAssertNil(TasksMacKeyboardController.destination(
            charactersIgnoringModifiers: ",",
            modifierFlags: [.control]
        ))
    }

    func testCacheClearingRefreshUsesTheExactActiveWindowChord() {
        XCTAssertTrue(TasksMacKeyboardController.shouldPerformCacheClearingRefresh(
            charactersIgnoringModifiers: "r",
            modifierFlags: [.command, .option],
            isRepeat: false,
            tasksWindowIsKey: true
        ))
        XCTAssertFalse(TasksMacKeyboardController.shouldPerformCacheClearingRefresh(
            charactersIgnoringModifiers: "r",
            modifierFlags: [.command],
            isRepeat: false,
            tasksWindowIsKey: true
        ))
        XCTAssertFalse(TasksMacKeyboardController.shouldPerformCacheClearingRefresh(
            charactersIgnoringModifiers: "r",
            modifierFlags: [.command, .option],
            isRepeat: true,
            tasksWindowIsKey: true
        ))
        XCTAssertFalse(TasksMacKeyboardController.shouldPerformCacheClearingRefresh(
            charactersIgnoringModifiers: "r",
            modifierFlags: [.command, .option],
            isRepeat: false,
            tasksWindowIsKey: false
        ))
    }

    func testCacheClearingRefreshPreservesDurableWebStorage() {
        let clearedTypes = TasksBrowserModel.reloadSafeWebsiteDataTypes

        XCTAssertTrue(clearedTypes.contains(WKWebsiteDataTypeDiskCache))
        XCTAssertTrue(clearedTypes.contains(WKWebsiteDataTypeFetchCache))
        XCTAssertTrue(clearedTypes.contains(WKWebsiteDataTypeMemoryCache))
        XCTAssertTrue(clearedTypes.contains(
            WKWebsiteDataTypeOfflineWebApplicationCache
        ))
        XCTAssertFalse(clearedTypes.contains(WKWebsiteDataTypeCookies))
        XCTAssertFalse(clearedTypes.contains(WKWebsiteDataTypeLocalStorage))
        XCTAssertFalse(clearedTypes.contains(
            WKWebsiteDataTypeIndexedDBDatabases
        ))
        XCTAssertFalse(clearedTypes.contains(
            WKWebsiteDataTypeServiceWorkerRegistrations
        ))
    }

    func testGlobalQuickEntryShortcutRoundTripsThroughNativeStorage() throws {
        let suiteName = "TasksMacTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let shortcut = TaskQuickEntryShortcutPayload(
            code: "Space",
            command: false,
            control: true,
            option: true,
            shift: false
        )

        TasksGlobalShortcutStore.save(shortcut, defaults: defaults)

        XCTAssertEqual(
            TasksGlobalShortcutStore.load(defaults: defaults),
            shortcut
        )
        XCTAssertEqual(TasksGlobalShortcutStore.display(shortcut), "⌃⌥Space")
        XCTAssertEqual(TasksGlobalShortcutKeyMap.keyCode(for: "Space"), 49)
        XCTAssertNil(TasksGlobalShortcutKeyMap.keyCode(for: "Unsupported"))
    }

    func testFailedGlobalShortcutReplacementRetainsTheWorkingRegistration() throws {
        let suiteName = "TasksMacTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        var registrations = 0
        var unregistered: [EventHotKeyRef] = []
        let registrar = TasksGlobalShortcutRegistrar(
            defaults: defaults,
            installEventHandler: false,
            registerHotKey: { _, _, _, candidate in
                registrations += 1
                if registrations == 1 {
                    candidate.pointee = OpaquePointer(bitPattern: 1)
                    return noErr
                }
                candidate.pointee = nil
                return OSStatus(eventHotKeyExistsErr)
            },
            unregisterHotKey: {
                unregistered.append($0)
                return noErr
            }
        )
        let working = TaskQuickEntryShortcutPayload(
            code: "Space",
            command: false,
            control: true,
            option: true,
            shift: false
        )
        let reserved = TaskQuickEntryShortcutPayload(
            code: "KeyJ",
            command: true,
            control: false,
            option: false,
            shift: true
        )

        XCTAssertEqual(
            registrar.configure(working),
            TaskQuickEntryShortcutResponse(
                success: true,
                display: "⌃⌥Space",
                message: nil
            )
        )
        XCTAssertEqual(
            registrar.configure(reserved),
            TaskQuickEntryShortcutResponse(
                success: false,
                display: "⌃⌥Space",
                message: "That shortcut is reserved or already used by another application"
            )
        )
        XCTAssertEqual(TasksGlobalShortcutStore.load(defaults: defaults), working)
        XCTAssertTrue(unregistered.isEmpty)
    }

    func testClearingGlobalShortcutUnregistersAndRemovesTheStoredShortcut() throws {
        let suiteName = "TasksMacTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        var unregistered: [EventHotKeyRef] = []
        let registrar = TasksGlobalShortcutRegistrar(
            defaults: defaults,
            installEventHandler: false,
            registerHotKey: { _, _, _, candidate in
                candidate.pointee = OpaquePointer(bitPattern: 1)
                return noErr
            },
            unregisterHotKey: {
                unregistered.append($0)
                return noErr
            }
        )
        let shortcut = TaskQuickEntryShortcutPayload(
            code: "Space",
            command: false,
            control: true,
            option: true,
            shift: false
        )

        XCTAssertTrue(registrar.configure(shortcut).success)
        XCTAssertEqual(TasksGlobalShortcutStore.load(defaults: defaults), shortcut)
        XCTAssertEqual(
            registrar.clear(),
            TaskQuickEntryShortcutResponse(
                success: true,
                display: nil,
                message: nil
            )
        )
        XCTAssertEqual(unregistered.count, 1)
        XCTAssertNil(TasksGlobalShortcutStore.load(defaults: defaults))
    }

    func testGlobalQuickEntryPanelUsesTheAuthoritativeWebEditorOnAllSpaces() {
        let policy = TasksMacQuickEntryPanelPolicy.self

        XCTAssertEqual(policy.contentSize, NSSize(width: 520, height: 560))
        XCTAssertEqual(policy.webURL.host, "os.bath.garden")
        XCTAssertEqual(policy.webURL.path, "/tasks/today")
        XCTAssertEqual(
            URLComponents(
                url: policy.webURL,
                resolvingAgainstBaseURL: false
            )?.queryItems,
            [
                URLQueryItem(name: "native_new_task", value: "1"),
                URLQueryItem(name: "native_quick_entry", value: "1"),
            ]
        )
        XCTAssertTrue(policy.collectionBehavior.contains(.canJoinAllSpaces))
        XCTAssertTrue(policy.collectionBehavior.contains(.fullScreenAuxiliary))
        XCTAssertTrue(policy.collectionBehavior.contains(.transient))
        XCTAssertEqual(policy.dragRegionHeight, 44)
    }

    func testGlobalQuickEntryPanelCannotCollapseToHostedIntrinsicSize() {
        let panel = TasksMacQuickEntryPanel(
            contentRect: NSRect(x: 0, y: 0, width: 40, height: 80),
            styleMask: [.titled, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.contentViewController = NSHostingController(
            rootView: Color.clear.frame(width: 1, height: 1)
        )

        TasksMacQuickEntryPanelPolicy.apply(to: panel)

        XCTAssertEqual(
            panel.contentRect(forFrameRect: panel.frame).size,
            TasksMacQuickEntryPanelPolicy.contentSize
        )
        XCTAssertEqual(
            panel.contentMinSize,
            TasksMacQuickEntryPanelPolicy.contentSize
        )
        XCTAssertEqual(
            panel.contentMaxSize,
            TasksMacQuickEntryPanelPolicy.contentSize
        )
        XCTAssertFalse(panel.isOpaque)
        XCTAssertEqual(panel.backgroundColor, .clear)
        XCTAssertTrue(panel.hasShadow)
        XCTAssertTrue(panel.isMovableByWindowBackground)
        XCTAssertEqual(
            panel.contentView?.layer?.cornerRadius,
            TasksMacQuickEntryPanelPolicy.cornerRadius
        )
        XCTAssertEqual(
            panel.contentView?.layer?.borderWidth,
            TasksMacQuickEntryPanelPolicy.borderWidth
        )
        XCTAssertEqual(
            panel.contentView?.layer?.borderColor,
            TasksMacQuickEntryPanelPolicy.borderColor.cgColor
        )
        XCTAssertTrue(panel.contentView?.layer?.masksToBounds == true)
    }

    func testGlobalQuickEntryCancellationDispatchesTheOwnedWebEvent() {
        XCTAssertTrue(
            TasksMacQuickEntryPanelPolicy.cancelJavaScript.contains(
                "bathos:tasks-native-quick-entry-cancel"
            )
        )
    }

    func testGlobalQuickEntryForwardsOnlyTaskMetadataControlShortcuts() {
        let forwardedKeys = ["e", "r", "t", "y", "d", "f", "g", "c", "v"]
        for key in forwardedKeys {
            XCTAssertEqual(
                TasksMacQuickEntryControlShortcutPolicy.action(
                    charactersIgnoringModifiers: key,
                    modifierFlags: [.control]
                ),
                .forward(key)
            )
        }

        let consumedKeys = [
            "q", "w", "a", "s", "z", "x", "b",
            "1", "2", "3", "4", "5", "6",
        ]
        for key in consumedKeys {
            XCTAssertEqual(
                TasksMacQuickEntryControlShortcutPolicy.action(
                    charactersIgnoringModifiers: key,
                    modifierFlags: [.control]
                ),
                .consume
            )
        }
    }

    func testGlobalQuickEntryPreservesUnownedKeyboardBehavior() {
        XCTAssertEqual(
            TasksMacQuickEntryControlShortcutPolicy.action(
                charactersIgnoringModifiers: "p",
                modifierFlags: [.control]
            ),
            .passThrough
        )
        XCTAssertEqual(
            TasksMacQuickEntryControlShortcutPolicy.action(
                charactersIgnoringModifiers: "e",
                modifierFlags: []
            ),
            .passThrough
        )
        XCTAssertEqual(
            TasksMacQuickEntryControlShortcutPolicy.action(
                charactersIgnoringModifiers: "e",
                modifierFlags: [.control, .shift]
            ),
            .passThrough
        )
    }

    func testGlobalQuickEntryMetadataJavaScriptDispatchesOneControlKey() {
        let javaScript = TasksMacQuickEntryControlShortcutPolicy.javaScript(for: "e")

        XCTAssertTrue(javaScript.contains("document.activeElement"))
        XCTAssertTrue(javaScript.contains("new KeyboardEvent(\"keydown\""))
        XCTAssertTrue(javaScript.contains("key: \"e\""))
        XCTAssertTrue(javaScript.contains("ctrlKey: true"))
        XCTAssertEqual(javaScript.components(separatedBy: "dispatchEvent").count - 1, 1)
    }

    func testGlobalQuickEntryControllerPresentsTheDeclaredContentSize() throws {
        let controller = TasksMacQuickEntryPanelController { _ in }

        controller.show()
        let panel = try XCTUnwrap(
            NSApp.windows.compactMap { $0 as? TasksMacQuickEntryPanel }.first
        )
        defer {
            panel.orderOut(nil)
        }

        XCTAssertTrue(panel.isVisible)
        XCTAssertEqual(
            panel.contentRect(forFrameRect: panel.frame).size,
            TasksMacQuickEntryPanelPolicy.contentSize
        )
    }

    func testWarmGlobalQuickEntryImmediatelyPresentsItsLoadingShell() throws {
        let model = TasksBrowserModel(inPageNavigator: { _, _ in })
        let webView = WKWebView()
        model.webView = webView
        model.didFinishLoading()
        model.didBecomeContentReady()
        XCTAssertTrue(model.hasLoadedContent)

        let controller = TasksMacQuickEntryPanelController(
            browserModel: model
        ) { _ in }

        controller.show()
        let panel = try XCTUnwrap(
            NSApp.windows.compactMap { $0 as? TasksMacQuickEntryPanel }.first {
                $0.isVisible
            }
        )
        defer {
            panel.orderOut(nil)
        }

        XCTAssertTrue(panel.isVisible)
        XCTAssertFalse(model.quickEntryPresentationReady)
    }

    func testGlobalQuickEntryDragRegionExplicitlyStartsWindowDrag() throws {
        var capturedWindow: NSWindow?
        var capturedEvent: NSEvent?
        let dragView = TasksMacQuickEntryDragView { window, event in
            capturedWindow = window
            capturedEvent = event
        }
        let panel = TasksMacQuickEntryPanel(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 44),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        panel.contentView = dragView
        let event = try XCTUnwrap(NSEvent.mouseEvent(
            with: .leftMouseDown,
            location: NSPoint(x: 20, y: 20),
            modifierFlags: [],
            timestamp: 0,
            windowNumber: panel.windowNumber,
            context: nil,
            eventNumber: 1,
            clickCount: 1,
            pressure: 1
        ))

        dragView.mouseDown(with: event)

        XCTAssertTrue(capturedWindow === panel)
        XCTAssertTrue(capturedEvent === event)
        XCTAssertFalse(dragView.mouseDownCanMoveWindow)
    }

    func testEscapeIsConsumedOnlyForTheKeyTasksWindow() {
        XCTAssertTrue(TasksMacKeyboardController.shouldConsumeEscape(
            keyCode: 53,
            modifierFlags: [],
            tasksWindowIsKey: true
        ))
        XCTAssertFalse(TasksMacKeyboardController.shouldConsumeEscape(
            keyCode: 53,
            modifierFlags: [.command],
            tasksWindowIsKey: true
        ))
        XCTAssertFalse(TasksMacKeyboardController.shouldConsumeEscape(
            keyCode: 53,
            modifierFlags: [],
            tasksWindowIsKey: false
        ))
    }

    func testDeepLinkRoutesStayBounded() {
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://list/upcoming")!),
            .list(.upcoming)
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://list/unsupported")!),
            .list(.today)
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://new/someday")!),
            .newTaskInList(.someday)
        )
    }

    func testLargeWidgetNewTaskDeepLinkTargetsTodayInboxOrConfiguredList() {
        let todayURL = TaskWidgetPresentationPolicy.largeWidgetNewTaskURL(for: .today)

        XCTAssertEqual(todayURL, TaskNativeRoute.newTask.deepLinkURL)
        XCTAssertEqual(TaskNativeRoute.parse(todayURL), .newTask)

        for listID in [TaskWidgetListID.upcoming, .anytime, .someday] {
            let url = TaskWidgetPresentationPolicy.largeWidgetNewTaskURL(for: listID)

            XCTAssertEqual(url.absoluteString, "bathostasks://new/\(listID.rawValue)")
            XCTAssertEqual(TaskNativeRoute.parse(url), .newTaskInList(listID))
        }
    }

    func testSettingsDestinationUsesTheCanonicalWebRoute() {
        XCTAssertEqual(
            TasksMacDestination.settings.nativeRoute.webURL.path,
            "/tasks/config"
        )
    }

    func testNavigationPolicyKeepsOnlyTasksAndRequiredPlatformRoutesInApp() {
        XCTAssertEqual(
            TasksMacWebNavigationPolicy.disposition(
                for: URL(string: "https://os.bath.garden/tasks/today")!
            ),
            .allow
        )
        XCTAssertEqual(
            TasksMacWebNavigationPolicy.disposition(
                for: URL(string: "https://os.bath.garden/account")!
            ),
            .allow
        )
        XCTAssertEqual(
            TasksMacWebNavigationPolicy.disposition(
                for: URL(string: "https://os.bath.garden/budget")!
            ),
            .openExternally
        )
        XCTAssertEqual(
            TasksMacWebNavigationPolicy.disposition(
                for: URL(string: "obsidian://open?vault=Personal")!
            ),
            .openExternally
        )
    }

    func testMacWidgetSupportsOnlyTheLargeFamily() {
        XCTAssertEqual(TaskWidgetPlatformPolicy.supportedFamilies, [.systemLarge])
        XCTAssertEqual(TaskWidgetPresentationPolicy.largeWidgetTaskLimit, 10)
        XCTAssertEqual(
            TaskWidgetListID.widgetConfigurationCases,
            [.today, .upcoming, .anytime, .someday]
        )
    }

    func testLockScreenRowsReserveWidthForTheSummary() {
        XCTAssertEqual(
            TaskWidgetPresentationPolicy.lockScreenLeadingSystemImageName,
            "square"
        )
    }

    func testPrimaryLinkPresentationRemainsProtocolAware() {
        XCTAssertEqual(
            TaskWidgetPrimaryLink(
                href: "https://example.atlassian.net/browse/PF-1",
                kind: .link
            ).systemImageName,
            "bolt"
        )
        XCTAssertEqual(
            TaskWidgetPrimaryLink(
                href: "obsidian://open?vault=Personal",
                kind: .link
            ).systemImageName,
            "doc.text"
        )
    }

    func testCompletingAWidgetTaskUpdatesCachedActiveAndDoneLists() throws {
        let taskID = UUID()
        var snapshot = makeSnapshot(taskID: taskID)

        XCTAssertTrue(snapshot.completeTask(
            taskID,
            completedAt: "2026-07-30T07:00:00Z"
        ))
        XCTAssertFalse(snapshot.list(.today)?.tasks.contains {
            $0.id == taskID
        } ?? true)
        XCTAssertEqual(
            snapshot.list(.done)?.tasks.first?.terminalState,
            "completed"
        )
    }

    func testWidgetStorePreservesTheLastValidSnapshot() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer {
            try? FileManager.default.removeItem(at: directory)
        }
        let store = TaskWidgetStore(directoryURL: directory)
        let snapshot = makeSnapshot(taskID: UUID())

        XCTAssertTrue(try store.store(snapshot))
        XCTAssertFalse(try store.store(snapshot))
        XCTAssertEqual(try store.load(), snapshot)
        XCTAssertThrowsError(try store.accept(Data("invalid".utf8)))
        XCTAssertEqual(try store.load(), snapshot)
    }

    private func makeSnapshot(taskID: UUID) -> TaskWidgetSnapshot {
        let task = TaskWidgetTask(
            id: taskID,
            summary: "Review Today",
            deadline: nil,
            todaySection: "inbox",
            actionability: "actionable",
            terminalState: nil
        )
        return TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: TaskWidgetSnapshot.schemaVersion,
            ownerId: UUID(),
            generatedAt: "2026-07-30T06:00:00Z",
            planningDate: "2026-07-30",
            lists: TaskWidgetListID.allCases.map { listID in
                TaskWidgetList(
                    id: listID,
                    title: listID.title,
                    totalCount: listID == .today ? 1 : 0,
                    truncated: false,
                    tasks: listID == .today ? [task] : []
                )
            }
        )
    }
}
