import AppKit
import Carbon
import SwiftUI
import UserNotifications
import WebKit
import XCTest
@testable import TasksMac

@MainActor
final class TasksMacTests: XCTestCase {
    func testNativeNotificationStatusMapsAppleAuthorization() {
        XCTAssertEqual(
            TaskNativeNotificationAuthorizationState.resolve(.notDetermined),
            .notDetermined
        )
        XCTAssertEqual(
            TaskNativeNotificationAuthorizationState.resolve(.denied),
            .denied
        )
        XCTAssertEqual(
            TaskNativeNotificationAuthorizationState.resolve(.authorized),
            .enabled
        )
    }

    func testNativeBadgeUsesTheFullTodayTotalOnlyWhenAuthorized() {
        var snapshot = makeSnapshot(taskID: UUID())
        snapshot.todayTotalCount = 42
        snapshot.lists = snapshot.lists.map { list in
            guard list.id == .today else { return list }
            return TaskWidgetList(
                id: list.id,
                title: list.title,
                totalCount: 27,
                truncated: true,
                tasks: list.tasks
            )
        }

        XCTAssertEqual(
            TaskNativeBadgePolicy.count(
                from: snapshot,
                notificationsEnabled: true,
                badgesEnabled: true
            ),
            42
        )
        XCTAssertEqual(
            TaskNativeBadgePolicy.count(
                from: snapshot,
                notificationsEnabled: false,
                badgesEnabled: true
            ),
            0
        )
        XCTAssertEqual(
            TaskNativeBadgePolicy.count(
                from: snapshot,
                notificationsEnabled: true,
                badgesEnabled: false
            ),
            0
        )
    }

    func testNativeBadgeAuthorizationRepairOnlyMigratesAuthorizedBadgeGapOnce() {
        XCTAssertTrue(
            TaskNativeBadgeAuthorizationRepairPolicy.shouldRequestRepair(
                authorizationStatus: .authorized,
                badgeSetting: .notSupported,
                repairAlreadyAttempted: false
            )
        )
        XCTAssertTrue(
            TaskNativeBadgeAuthorizationRepairPolicy.shouldRequestRepair(
                authorizationStatus: .authorized,
                badgeSetting: .disabled,
                repairAlreadyAttempted: false
            )
        )
        XCTAssertFalse(
            TaskNativeBadgeAuthorizationRepairPolicy.shouldRequestRepair(
                authorizationStatus: .authorized,
                badgeSetting: .enabled,
                repairAlreadyAttempted: false
            )
        )
        XCTAssertFalse(
            TaskNativeBadgeAuthorizationRepairPolicy.shouldRequestRepair(
                authorizationStatus: .authorized,
                badgeSetting: .notSupported,
                repairAlreadyAttempted: true
            )
        )
        XCTAssertFalse(
            TaskNativeBadgeAuthorizationRepairPolicy.shouldRequestRepair(
                authorizationStatus: .denied,
                badgeSetting: .notSupported,
                repairAlreadyAttempted: false
            )
        )
    }

    func testNativeReminderProjectionKeepsTheEarliestFutureItems() throws {
        let now = try XCTUnwrap(
            ISO8601DateFormatter().date(from: "2026-08-06T16:00:00Z")
        )
        let first = TaskNativeReminderProjectionItem(
            id: UUID(),
            taskId: UUID(),
            summary: "First",
            resolvedAt: "2026-08-06T17:00:00Z"
        )
        let second = TaskNativeReminderProjectionItem(
            id: UUID(),
            taskId: UUID(),
            summary: "Second",
            resolvedAt: "2026-08-06T18:00:00Z"
        )
        let projection = TaskNativeReminderProjection(
            ownerId: UUID(),
            generatedAt: "2026-08-06T16:00:00Z",
            reminders: [second, first]
        )

        XCTAssertTrue(projection.isValid)
        XCTAssertEqual(projection.scheduledItems(after: now, limit: 1), [first])

        let request = try XCTUnwrap(
            TaskNativeNotificationCoordinator.notificationRequest(
                ownerId: projection.ownerId,
                item: first,
                now: now
            )
        )
        XCTAssertEqual(request.content.title, "Reminder")
        XCTAssertEqual(request.content.body, "First")
        let trigger = try XCTUnwrap(request.trigger as? UNTimeIntervalNotificationTrigger)
        XCTAssertEqual(trigger.timeInterval, 3_600, accuracy: 0.001)
    }

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

    func testGlobalQuickEntryPanelUsesTheNativeEditorOnAllSpaces() {
        let policy = TasksMacQuickEntryPanelPolicy.self

        XCTAssertEqual(policy.contentSize, NSSize(width: 520, height: 560))
        XCTAssertTrue(policy.collectionBehavior.contains(.canJoinAllSpaces))
        XCTAssertTrue(policy.collectionBehavior.contains(.fullScreenAuxiliary))
        XCTAssertTrue(policy.collectionBehavior.contains(.transient))
        XCTAssertEqual(policy.dragRegionHeight, 44)
    }

    func testGlobalQuickEntryCentersOnTheScreenContainingThePointer() {
        let first = NSRect(x: 0, y: 0, width: 1440, height: 900)
        let second = NSRect(x: 1440, y: 120, width: 1920, height: 1080)

        let target = TasksMacQuickEntryPanelPolicy.targetScreenFrame(
            pointerLocation: NSPoint(x: 1800, y: 600),
            screenFrames: [first, second]
        )

        XCTAssertEqual(target, second)
        XCTAssertEqual(
            TasksMacQuickEntryPanelPolicy.centeredOrigin(
                panelSize: TasksMacQuickEntryPanelPolicy.contentSize,
                in: second
            ),
            NSPoint(x: 2140, y: 380)
        )
    }

    func testGlobalQuickEntryFallsBackToTheFirstAvailableScreen() {
        let first = NSRect(x: 0, y: 0, width: 1440, height: 900)

        XCTAssertEqual(
            TasksMacQuickEntryPanelPolicy.targetScreenFrame(
                pointerLocation: NSPoint(x: -500, y: -500),
                screenFrames: [first]
            ),
            first
        )
        XCTAssertNil(
            TasksMacQuickEntryPanelPolicy.targetScreenFrame(
                pointerLocation: .zero,
                screenFrames: []
            )
        )
    }

    func testGlobalQuickEntryPanelCannotCollapseToIntrinsicSize() {
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

    func testGlobalQuickEntryForwardsOnlyTaskMetadataControlShortcuts() {
        let forwardedKeys = [
            "e", "r", "t", "y", "n", "d", "f", "g", "h", "c", "v",
        ]
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

    func testNativeQuickEntryMetadataShortcutsMutateTheDraftSemantically() throws {
        let firstArea = TasksNativeQuickEntryArea(id: UUID(), name: "Household")
        let secondArea = TasksNativeQuickEntryArea(id: UUID(), name: "Work")
        let model = TasksNativeQuickEntryViewModel(areas: [firstArea, secondArea])

        XCTAssertFalse(model.canSave)

        model.handleControlShortcut("e")
        XCTAssertEqual(model.draft.focus, .start)
        XCTAssertEqual(model.pickerRequest?.kind, .start)
        let startPickerRequestID = try XCTUnwrap(model.pickerRequest?.id)

        model.handleControlShortcut("t")
        XCTAssertEqual(model.draft.todaySection, "now")
        XCTAssertEqual(model.draft.focus, .start)
        XCTAssertEqual(model.pickerRequest?.id, startPickerRequestID)

        model.handleControlShortcut("y")
        XCTAssertEqual(model.draft.reminderLocalTime, "09:00")
        XCTAssertEqual(model.draft.focus, .reminder)

        model.handleControlShortcut("r")
        XCTAssertNil(model.draft.todaySection)
        XCTAssertNil(model.draft.startDate)
        XCTAssertNil(model.draft.reminderLocalTime)
        XCTAssertEqual(model.draft.focus, .start)
        XCTAssertEqual(model.pickerRequest?.id, startPickerRequestID)

        XCTAssertFalse(model.handleControlShortcut("n"))
        XCTAssertTrue(model.draft.showsNotes)
        XCTAssertEqual(model.draft.focus, .notes)
        XCTAssertTrue(model.handleControlShortcut("n"))

        XCTAssertFalse(model.handleControlShortcut("h"))
        XCTAssertTrue(model.draft.showsLink)
        XCTAssertEqual(model.draft.focus, .link)
        XCTAssertTrue(model.handleControlShortcut("h"))

        model.handleControlShortcut("c")
        XCTAssertEqual(model.draft.checklist.count, 1)
        XCTAssertTrue(model.draft.showsChecklist)
        let trailingID = try XCTUnwrap(model.draft.checklist.last?.id)

        model.handleControlShortcut("c")
        XCTAssertEqual(model.draft.checklist.count, 2)
        XCTAssertNotEqual(model.draft.checklist.first?.id, trailingID)
        XCTAssertEqual(model.draft.checklist.last?.id, trailingID)

        model.handleControlShortcut("f")
        XCTAssertEqual(model.draft.actionability, "rechecking")

        model.handleControlShortcut("d")
        XCTAssertEqual(model.draft.focus, .deadline)
        XCTAssertEqual(model.pickerRequest?.kind, .deadline)
        let deadlinePickerRequestID = try XCTUnwrap(model.pickerRequest?.id)
        XCTAssertNotEqual(deadlinePickerRequestID, startPickerRequestID)

        model.handleControlShortcut("v")
        XCTAssertEqual(model.draft.areaID, firstArea.id)
        XCTAssertEqual(model.draft.focus, .area)
        model.handleControlShortcut("v")
        XCTAssertEqual(model.draft.areaID, secondArea.id)
        model.handleControlShortcut("v")
        XCTAssertNil(model.draft.areaID)

        model.handleControlShortcut("g")
        XCTAssertEqual(model.draft.destination, "someday")
        XCTAssertEqual(model.pickerRequest?.id, deadlinePickerRequestID)

        let beforeSuppressedCommand = model.draft
        model.handleControlShortcut("x")
        XCTAssertEqual(model.draft, beforeSuppressedCommand)

        model.draft.summary = "Ready to save"
        XCTAssertTrue(model.canSave)
    }

    func testNativeQuickEntryFocusTraversalUsesContractOrderAndWraps() throws {
        let firstChecklistID = UUID()
        let secondChecklistID = UUID()
        var draft = TasksNativeQuickEntryDraft()
        draft.showsNotes = true
        draft.showsLink = true
        draft.checklist = [
            .init(id: firstChecklistID, title: "First"),
            .init(id: secondChecklistID, title: "Second"),
        ]
        draft.showsChecklist = true
        draft.reminderLocalTime = "09:00"

        let expected: [TasksNativeQuickEntryFocusTarget] = [
            .summary,
            .start,
            .reminder,
            .deadline,
            .area,
            .actionability,
            .notes,
            .link,
            .checklist(firstChecklistID),
            .checklist(secondChecklistID),
            .cancel,
            .save,
        ]
        XCTAssertEqual(draft.availableFocusTargets, expected)

        for next in expected.dropFirst() {
            draft.moveFocus(reverse: false)
            XCTAssertEqual(draft.focus, next)
        }
        draft.moveFocus(reverse: false)
        XCTAssertEqual(draft.focus, .summary)
        draft.moveFocus(reverse: true)
        XCTAssertEqual(draft.focus, .save)

        draft.focus = .checklist(UUID())
        draft.moveFocus(reverse: false)
        XCTAssertEqual(draft.focus, .summary)
        draft.focus = .checklist(UUID())
        draft.moveFocus(reverse: true)
        XCTAssertEqual(draft.focus, .save)
    }

    func testNativeQuickEntryFocusTraversalIncludesOptionalDisclosureButtons() {
        var draft = TasksNativeQuickEntryDraft()

        XCTAssertEqual(
            draft.availableFocusTargets,
            [
                .summary,
                .start,
                .deadline,
                .area,
                .actionability,
                .notes,
                .link,
                .checklistDisclosure,
                .cancel,
                .save,
            ]
        )

        draft.focus = .actionability
        draft.moveFocus(reverse: false)
        XCTAssertEqual(draft.focus, .notes)
        draft.moveFocus(reverse: false)
        XCTAssertEqual(draft.focus, .link)
        draft.moveFocus(reverse: false)
        XCTAssertEqual(draft.focus, .checklistDisclosure)
    }

    func testNativeQuickEntryPanelOwnsForwardAndReverseTabTraversal() throws {
        let panel = TasksMacQuickEntryPanel(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 560),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        var traversals: [Bool] = []
        panel.onTabTraversal = { reverse in
            traversals.append(reverse)
            return true
        }

        for modifiers: NSEvent.ModifierFlags in [[], [.shift]] {
            let event = try XCTUnwrap(NSEvent.keyEvent(
                with: .keyDown,
                location: .zero,
                modifierFlags: modifiers,
                timestamp: 0,
                windowNumber: panel.windowNumber,
                context: nil,
                characters: "\t",
                charactersIgnoringModifiers: "\t",
                isARepeat: false,
                keyCode: 48
            ))
            panel.sendEvent(event)
        }

        XCTAssertEqual(traversals, [false, true])
    }

    func testNativeQuickEntryRepeatedTextShortcutMovesCaretWithoutDelay() throws {
        let panel = TasksMacQuickEntryPanel(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 560),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        let editor = NSTextView(frame: NSRect(x: 0, y: 0, width: 200, height: 80))
        editor.string = "Immediate typing stays ordered"
        panel.contentView = editor
        XCTAssertTrue(panel.makeFirstResponder(editor))

        editor.setSelectedRange(NSRange(location: editor.string.utf16.count, length: 0))
        panel.moveTextInsertionToOppositeBoundary()
        XCTAssertEqual(editor.selectedRange(), NSRange(location: 0, length: 0))

        panel.moveTextInsertionToOppositeBoundary()
        XCTAssertEqual(
            editor.selectedRange(),
            NSRange(location: editor.string.utf16.count, length: 0)
        )
    }

    func testNativeQuickEntryNativePanelCancelsWithoutWebReadiness() throws {
        var finishes: [Bool] = []
        let controller = TasksMacQuickEntryPanelController {
            finishes.append($0)
        }

        controller.show()
        let panel = try XCTUnwrap(
            NSApp.windows.compactMap { $0 as? TasksMacQuickEntryPanel }.first {
                $0.isVisible
            }
        )
        XCTAssertTrue(panel.isVisible)

        controller.toggle()

        XCTAssertFalse(panel.isVisible)
        XCTAssertEqual(finishes, [false])
    }

    func testNativeQuickEntryDatePickerRemainsInsideTheFloatingPanel() throws {
        let controller = TasksMacQuickEntryPanelController { _ in }

        controller.show()
        let panel = try XCTUnwrap(
            NSApp.windows.compactMap { $0 as? TasksMacQuickEntryPanel }.first {
                $0.isVisible
            }
        )
        defer { panel.orderOut(nil) }

        panel.onControlShortcut?("e")
        RunLoop.main.run(until: Date().addingTimeInterval(0.1))

        XCTAssertTrue(panel.isVisible)
        XCTAssertFalse(
            NSApp.windows.contains { window in
                window.parent === panel && !(window is TasksMacQuickEntryPanel)
            }
        )
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

    func testMacWidgetSupportsAdaptiveListFamilies() {
        XCTAssertEqual(
            TaskWidgetPlatformPolicy.supportedFamilies,
            [.systemMedium, .systemLarge, .systemExtraLarge]
        )
        XCTAssertEqual(TaskWidgetPresentationPolicy.mediumWidgetTaskLimit, 4)
        XCTAssertEqual(TaskWidgetPresentationPolicy.largeWidgetTaskLimit, 10)
        XCTAssertEqual(TaskWidgetPresentationPolicy.extraLargeWidgetTaskLimit, 16)
        XCTAssertEqual(
            TaskWidgetListID.widgetConfigurationCases,
            [.today, .upcoming, .anytime, .someday]
        )
    }

    func testPrimaryLinkPresentationRemainsProtocolAware() {
        XCTAssertEqual(
            TaskWidgetPrimaryLink(
                href: "https://example.atlassian.net/browse/PF-1",
                kind: .link
            ).iconKind,
            .jira
        )
        XCTAssertEqual(
            TaskWidgetPrimaryLink(
                href: "obsidian://open?vault=Personal",
                kind: .link
            ).iconKind,
            .obsidian
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

    func testNativeQuickEntryContractMatchesTheNeutralSource() {
        XCTAssertEqual(
            TasksNativeQuickEntryContract.sourceFingerprint,
            "5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1"
        )
        XCTAssertEqual(
            TasksNativeQuickEntryContract.fields.map(\.id),
            [
                .summary,
                .start,
                .reminder,
                .deadline,
                .area,
                .actionability,
                .notes,
                .link,
                .checklist,
            ]
        )
        XCTAssertEqual(
            TasksNativeQuickEntryContract.commands.map(\.key),
            ["e", "r", "t", "y", "n", "d", "f", "g", "h", "c", "v"]
        )
        XCTAssertEqual(
            TasksNativeQuickEntryContract.layoutSections.map(\.id),
            [.summary, .temporal, .identity, .optional]
        )
        XCTAssertEqual(
            TasksNativeQuickEntryContract.layoutSections.flatMap(\.fieldIDs),
            TasksNativeQuickEntryContract.fields.map(\.id)
        )
    }

    func testNativeQuickEntryDraftUsesTodayInboxDefaultsAndStableRetryIDs() throws {
        let clientMutationID = UUID()
        let operationID = UUID()
        var draft = TasksNativeQuickEntryDraft(
            clientMutationID: clientMutationID,
            operationID: operationID
        )
        draft.summary = "  Call Babs  "

        let submission = try draft.normalizedSubmission(
            planningDate: try TasksNativeCalendarDate(year: 2026, month: 8, day: 5)
        )

        XCTAssertEqual(submission.summary, "Call Babs")
        XCTAssertEqual(submission.destination, "anytime")
        XCTAssertEqual(submission.todaySection, "inbox")
        XCTAssertEqual(submission.clientMutationID, clientMutationID)
        XCTAssertEqual(submission.operationID, operationID)
        XCTAssertEqual(
            submission.contractFingerprint,
            TasksNativeQuickEntryContract.sourceFingerprint
        )
    }

    func testNativeQuickEntryDraftNormalizesOptionalFieldsAndChecklistOrder() throws {
        let firstID = UUID()
        let blankID = UUID()
        let secondID = UUID()
        var draft = TasksNativeQuickEntryDraft()
        draft.summary = "Document the release"
        draft.notes = "  Keep the Markdown.  "
        draft.link = "   "
        draft.checklist = [
            .init(id: firstID, title: "  First  "),
            .init(id: blankID, title: ""),
            .init(id: secondID, title: "Second"),
        ]

        let submission = try draft.normalizedSubmission(
            planningDate: try TasksNativeCalendarDate(year: 2026, month: 8, day: 5)
        )

        XCTAssertEqual(submission.notes, "Keep the Markdown.")
        XCTAssertNil(submission.link)
        XCTAssertEqual(
            submission.checklist,
            [
                .init(clientID: firstID, title: "First", position: 0),
                .init(clientID: secondID, title: "Second", position: 1),
            ]
        )
    }

    func testNativeQuickEntryDraftSerializesEverySupportedMetadataField() throws {
        let planningDate = try TasksNativeCalendarDate(year: 2026, month: 8, day: 6)
        let startDate = try TasksNativeCalendarDate(year: 2026, month: 8, day: 7)
        let deadlineDate = try TasksNativeCalendarDate(year: 2025, month: 1, day: 2)
        let areaID = UUID()
        let checklistID = UUID()
        var draft = TasksNativeQuickEntryDraft()
        draft.summary = "  Complete capture  "
        draft.notes = "  Markdown notes  "
        draft.link = "  https://example.test/path  "
        draft.checklist = [.init(id: checklistID, title: "  First step  ")]
        draft.setExplicitStart(startDate)
        draft.reminderLocalTime = "14:45"
        draft.deadlineDate = deadlineDate
        draft.areaID = areaID
        draft.actionability = "waiting"

        let submission = try draft.normalizedSubmission(planningDate: planningDate)

        XCTAssertEqual(submission.summary, "Complete capture")
        XCTAssertEqual(submission.notes, "Markdown notes")
        XCTAssertEqual(submission.link, "https://example.test/path")
        XCTAssertEqual(
            submission.checklist,
            [.init(clientID: checklistID, title: "First step", position: 0)]
        )
        XCTAssertEqual(submission.destination, "anytime")
        XCTAssertNil(submission.todaySection)
        XCTAssertEqual(submission.startDate, "2026-08-07")
        XCTAssertEqual(submission.reminderLocalTime, "14:45")
        XCTAssertEqual(submission.deadlineDate, "2025-01-02")
        XCTAssertEqual(submission.areaID, areaID)
        XCTAssertEqual(submission.actionability, "waiting")
    }

    func testNativeQuickEntryDraftRejectsEveryContractBoundedTextField() throws {
        let planningDate = try TasksNativeCalendarDate(year: 2026, month: 8, day: 6)
        func maximum(_ fieldID: TasksNativeQuickEntryContract.FieldID) throws -> Int {
            try XCTUnwrap(
                TasksNativeQuickEntryContract.fields.first { $0.id == fieldID }?
                    .maximumCharacters
            )
        }

        var draft = TasksNativeQuickEntryDraft()
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual($0 as? TasksNativeQuickEntryDraftError, .summaryRequired)
        }

        draft.summary = String(repeating: "a", count: try maximum(.summary) + 1)
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryDraftError,
                .fieldTooLong(field: "Summary", maximum: 500)
            )
        }

        draft.summary = "Valid"
        draft.notes = String(repeating: "n", count: try maximum(.notes) + 1)
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryDraftError,
                .fieldTooLong(field: "Notes", maximum: 100_000)
            )
        }

        draft.notes = ""
        draft.link = String(repeating: "l", count: try maximum(.link) + 1)
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryDraftError,
                .fieldTooLong(field: "Link", maximum: 8_000)
            )
        }

        draft.link = ""
        draft.checklist = [
            .init(title: String(repeating: "c", count: try maximum(.checklist) + 1)),
        ]
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryDraftError,
                .fieldTooLong(field: "Checklist", maximum: 500)
            )
        }
    }

    func testNativeQuickEntryDraftRejectsChecklistAndEnumerationBounds() throws {
        let planningDate = try TasksNativeCalendarDate(year: 2026, month: 8, day: 6)
        var draft = TasksNativeQuickEntryDraft()
        draft.summary = "Valid"
        draft.checklist = (0...TasksNativeQuickEntryContract.maximumChecklistItems).map {
            .init(title: "Item \($0)")
        }
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryDraftError,
                .tooManyChecklistItems(
                    maximum: TasksNativeQuickEntryContract.maximumChecklistItems
                )
            )
        }

        draft.checklist = []
        draft.todaySection = "invalid"
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual($0 as? TasksNativeQuickEntryDraftError, .invalidTodaySection)
        }

        draft.todaySection = "inbox"
        draft.actionability = "invalid"
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual($0 as? TasksNativeQuickEntryDraftError, .invalidActionability)
        }
    }

    func testNativeQuickEntryPlacementPickersMaintainPlanningInvariants() throws {
        let planningDate = try TasksNativeCalendarDate(year: 2026, month: 8, day: 6)
        let futureDate = try TasksNativeCalendarDate(year: 2026, month: 8, day: 12)
        var draft = TasksNativeQuickEntryDraft()

        draft.setExplicitStart(futureDate)
        XCTAssertEqual(draft.destination, "anytime")
        XCTAssertEqual(draft.startDate, futureDate)
        XCTAssertNil(draft.todaySection)

        draft.reminderLocalTime = "09:00"
        draft.setTodaySection("later")
        XCTAssertNil(draft.startDate)
        XCTAssertEqual(draft.todaySection, "later")
        XCTAssertEqual(draft.reminderLocalTime, "09:00")

        draft.setSomeday()
        XCTAssertEqual(draft.destination, "someday")
        XCTAssertNil(draft.todaySection)
        XCTAssertNil(draft.startDate)
        XCTAssertNil(draft.reminderLocalTime)

        draft.setTodaySection("inbox")
        draft.reminderLocalTime = "10:15"
        draft.clearStart()
        XCTAssertEqual(draft.destination, "anytime")
        XCTAssertNil(draft.todaySection)
        XCTAssertNil(draft.startDate)
        XCTAssertNil(draft.reminderLocalTime)

        draft.summary = "Past deadlines remain valid"
        draft.deadlineDate = try TasksNativeCalendarDate(year: 1999, month: 1, day: 1)
        XCTAssertNoThrow(try draft.normalizedSubmission(planningDate: planningDate))
    }

    func testNativeQuickEntryChecklistSupportsEveryDraftOperation() throws {
        let firstID = UUID()
        let secondID = UUID()
        let thirdID = UUID()
        var draft = TasksNativeQuickEntryDraft()

        draft.appendChecklistItem(title: "Second", id: secondID)
        draft.prependChecklistItem(title: "First", id: firstID)
        let insertedID = draft.insertChecklistItem(after: firstID)
        draft.checklist[draft.checklist.firstIndex { $0.id == insertedID }!].title = "Inserted"
        draft.appendChecklistItem(title: "Third", id: thirdID)
        XCTAssertEqual(
            draft.checklist.map(\.title),
            ["First", "Inserted", "Second", "Third"]
        )

        draft.moveChecklistItems(fromOffsets: IndexSet(integer: 3), toOffset: 0)
        XCTAssertEqual(
            draft.checklist.map(\.title),
            ["Third", "First", "Inserted", "Second"]
        )

        let blankID = draft.appendChecklistItem()
        draft.discardBlankChecklistItems(except: blankID)
        XCTAssertEqual(draft.checklist.last?.id, blankID)
        draft.discardBlankChecklistItems()
        XCTAssertFalse(draft.checklist.contains { $0.id == blankID })

        var blankOnlyDraft = TasksNativeQuickEntryDraft()
        blankOnlyDraft.appendChecklistItem()
        blankOnlyDraft.discardBlankChecklistItems()
        XCTAssertFalse(blankOnlyDraft.showsChecklist)
        XCTAssertEqual(
            blankOnlyDraft.availableFocusTargets,
            [
                .summary,
                .start,
                .deadline,
                .area,
                .actionability,
                .notes,
                .link,
                .checklistDisclosure,
                .cancel,
                .save,
            ]
        )

        draft.focus = .checklist(firstID)
        draft.removeChecklistItem(id: firstID)
        XCTAssertEqual(draft.focus, .checklist(insertedID))

        for id in draft.checklist.map(\.id) {
            draft.removeChecklistItem(id: id)
        }
        XCTAssertTrue(draft.checklist.isEmpty)
        XCTAssertFalse(draft.showsChecklist)
        XCTAssertEqual(draft.focus, .summary)
    }

    func testNativeQuickEntryDraftEnforcesPlanningAndReminderRules() throws {
        let planningDate = try TasksNativeCalendarDate(year: 2026, month: 8, day: 5)
        var draft = TasksNativeQuickEntryDraft()
        draft.summary = "Prepare brief"
        draft.clearStart()
        draft.reminderLocalTime = "09:00"

        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryDraftError,
                .reminderRequiresStart
            )
        }

        draft.reminderLocalTime = nil
        draft.setExplicitStart(
            try TasksNativeCalendarDate(year: 2026, month: 8, day: 4)
        )
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryDraftError,
                .startBeforePlanningDate
            )
        }

        draft.setExplicitStart(planningDate)
        draft.reminderLocalTime = "25:90"
        XCTAssertThrowsError(try draft.normalizedSubmission(planningDate: planningDate)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryDraftError,
                .invalidReminderTime
            )
        }

        draft.reminderLocalTime = "09:30"
        draft.deadlineDate = try TasksNativeCalendarDate(year: 2020, month: 1, day: 1)
        XCTAssertNoThrow(try draft.normalizedSubmission(planningDate: planningDate))
    }

    func testNativeQuickEntryDraftCyclesMetadataAndReordersChecklist() throws {
        let first = UUID()
        let second = UUID()
        let third = UUID()
        var draft = TasksNativeQuickEntryDraft()
        draft.checklist = [
            .init(id: first, title: "First"),
            .init(id: second, title: "Second"),
            .init(id: third, title: "Third"),
        ]

        draft.moveChecklistItems(fromOffsets: IndexSet(integer: 0), toOffset: 3)
        XCTAssertEqual(draft.checklist.map(\.id), [second, third, first])

        draft.cycleTodaySection()
        XCTAssertEqual(draft.todaySection, "now")
        draft.cycleActionability()
        XCTAssertEqual(draft.actionability, "rechecking")

        draft.setSomeday()
        XCTAssertEqual(draft.destination, "someday")
        XCTAssertNil(draft.todaySection)
        XCTAssertNil(draft.startDate)
    }

    func testNativeQuickEntryViewModelRejectsInvalidSaveWithoutSubmitting() async throws {
        var submissionCount = 0
        let model = TasksNativeQuickEntryViewModel(
            planningDate: try TasksNativeCalendarDate(year: 2026, month: 8, day: 6),
            submitHandler: { _ in
                submissionCount += 1
                return UUID()
            }
        )

        await model.submit()

        XCTAssertEqual(submissionCount, 0)
        XCTAssertEqual(
            model.draft.submissionState,
            .failed(message: "A task summary is required.")
        )
        XCTAssertFalse(model.canSave)
    }

    func testNativeQuickEntryViewModelPreservesDraftAndIdentityAcrossRetry() async throws {
        let taskID = UUID()
        var submissions: [TasksNativeQuickEntrySubmission] = []
        var accepted: [UUID] = []
        let model = TasksNativeQuickEntryViewModel(
            planningDate: try TasksNativeCalendarDate(year: 2026, month: 8, day: 6),
            submitHandler: { submission in
                submissions.append(submission)
                if submissions.count == 1 {
                    throw TasksNativeQuickEntryServiceFailure.unavailable
                }
                return taskID
            },
            onAccepted: { accepted.append($0) }
        )
        model.draft.summary = "Retry intact"
        model.draft.notes = "Keep this draft"
        model.draft.appendChecklistItem(title: "One")
        let originalDraft = model.draft

        await model.submit()

        XCTAssertEqual(
            model.draft.submissionState,
            .failed(message: "Quick Entry is not ready yet. Open Tasks and try again.")
        )
        XCTAssertEqual(model.draft.summary, originalDraft.summary)
        XCTAssertEqual(model.draft.notes, originalDraft.notes)
        XCTAssertEqual(model.draft.checklist, originalDraft.checklist)
        XCTAssertEqual(model.draft.clientMutationID, originalDraft.clientMutationID)
        XCTAssertEqual(model.draft.operationID, originalDraft.operationID)
        XCTAssertTrue(model.canSave)

        await model.submit()

        XCTAssertEqual(model.draft.submissionState, .accepted(taskID: taskID))
        XCTAssertEqual(accepted, [taskID])
        XCTAssertEqual(submissions.count, 2)
        XCTAssertEqual(submissions[0], submissions[1])
    }

    func testNativeQuickEntryViewModelCancelAndBootstrapTransitionsAreBounded() throws {
        var cancellationCount = 0
        let originalArea = TasksNativeQuickEntryArea(id: UUID(), name: "Original")
        let refreshedArea = TasksNativeQuickEntryArea(id: UUID(), name: "Refreshed")
        let model = TasksNativeQuickEntryViewModel(
            areas: [originalArea],
            onCancel: { cancellationCount += 1 }
        )

        model.cancel()
        XCTAssertEqual(cancellationCount, 1)

        model.beginBootstrapRefresh()
        XCTAssertTrue(model.isRefreshingBootstrap)
        model.finishBootstrapRefresh(.failure(TasksNativeQuickEntryServiceFailure.unavailable))
        XCTAssertFalse(model.isRefreshingBootstrap)
        XCTAssertEqual(model.areas, [originalArea])

        let bootstrap = TasksNativeQuickEntryBootstrap(
            outcome: "accepted",
            type: "nativeQuickEntryBootstrap",
            schemaVersion: TasksNativeQuickEntryContract.schemaVersion,
            payloadSchemaVersion: TasksNativeQuickEntryContract.payloadSchemaVersion,
            contractFingerprint: TasksNativeQuickEntryContract.sourceFingerprint,
            capability: TasksNativeQuickEntryContract.capability,
            ownerId: UUID(),
            generatedAt: "2026-08-06T07:00:00.000Z",
            planningDate: "2026-08-07",
            planningTimeZone: "America/Los_Angeles",
            areas: [refreshedArea],
            limits: .init(
                maximumChecklistItems: TasksNativeQuickEntryContract.maximumChecklistItems,
                maximumPayloadBytes: TasksNativeQuickEntryContract.maximumPayloadBytes
            )
        )
        model.draft.areaID = originalArea.id
        model.beginBootstrapRefresh()
        model.finishBootstrapRefresh(.success(bootstrap))

        XCTAssertFalse(model.isRefreshingBootstrap)
        XCTAssertEqual(model.areas, [refreshedArea])
        XCTAssertNil(model.draft.areaID)
        XCTAssertEqual(model.planningDate.iso8601, "2026-08-07")

        let firstMutationID = model.draft.clientMutationID
        model.draft.summary = "Discard me"
        model.reset(using: bootstrap)
        XCTAssertEqual(model.draft.summary, "")
        XCTAssertNotEqual(model.draft.clientMutationID, firstMutationID)
        XCTAssertEqual(model.draft.focus, .summary)
    }

    func testNativeQuickEntryCancelRemainsEffectiveDuringSubmission() async throws {
        let taskID = UUID()
        var cancellationCount = 0
        var accepted: [UUID] = []
        let model = TasksNativeQuickEntryViewModel(
            planningDate: try TasksNativeCalendarDate(year: 2026, month: 8, day: 6),
            submitHandler: { _ in
                try await Task.sleep(for: .seconds(10))
                return taskID
            },
            onCancel: { cancellationCount += 1 },
            onAccepted: { accepted.append($0) }
        )
        model.draft.summary = "Cancel pending capture"

        model.save()
        for _ in 0..<10 where model.draft.submissionState != .submitting {
            await Task.yield()
        }
        XCTAssertEqual(model.draft.submissionState, .submitting)

        model.cancel()
        await Task.yield()

        XCTAssertEqual(cancellationCount, 1)
        XCTAssertTrue(accepted.isEmpty)
    }

    func testNativeCalendarDateRejectsImpossibleDatesAndUsesStableWireFormat() throws {
        let leapDay = try TasksNativeCalendarDate(year: 2028, month: 2, day: 29)
        XCTAssertEqual(leapDay.iso8601, "2028-02-29")
        XCTAssertThrowsError(
            try TasksNativeCalendarDate(year: 2026, month: 2, day: 29)
        )
    }

    func testNativeQuickEntryBootstrapCacheIsPrivateAndContractBound() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TasksNativeQuickEntryBootstrapStore(
            fileURL: directory.appendingPathComponent("bootstrap.json")
        )
        let credential = makeQuickEntryCredential()
        let bootstrap = makeQuickEntryBootstrap(ownerID: credential.ownerId)

        try store.store(bootstrap, credential: credential)

        XCTAssertEqual(try store.load(credential: credential), bootstrap)
        let attributes = try FileManager.default.attributesOfItem(
            atPath: store.fileURL.path
        )
        XCTAssertEqual(
            (attributes[.posixPermissions] as? NSNumber)?.intValue,
            0o600
        )
        let wrongOwner = makeQuickEntryCredential(ownerID: UUID())
        XCTAssertThrowsError(try store.load(credential: wrongOwner)) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryServiceFailure,
                .incompatibleContract
            )
        }
    }

    func testNativeQuickEntryServiceRefreshesBootstrapWithBoundedAuthority() async throws {
        let credential = makeQuickEntryCredential()
        let bootstrap = makeQuickEntryBootstrap(ownerID: credential.ownerId)
        let responseData = try JSONEncoder().encode(bootstrap)
        var writtenBootstrap: TasksNativeQuickEntryBootstrap?
        var observedRequest: URLRequest?
        let endpoint = try XCTUnwrap(URL(string: "https://example.test/tasks-widget-actions"))
        let service = TasksNativeQuickEntryService(
            endpoint: endpoint,
            credentialLoader: { credential },
            bootstrapWriter: { value, _ in writtenBootstrap = value },
            transport: { request in
                observedRequest = request
                return (
                    responseData,
                    HTTPURLResponse(
                        url: endpoint,
                        statusCode: 200,
                        httpVersion: nil,
                        headerFields: nil
                    )!
                )
            }
        )

        let result = try await service.refreshBootstrap()

        XCTAssertEqual(result, bootstrap)
        XCTAssertEqual(writtenBootstrap, bootstrap)
        XCTAssertEqual(
            observedRequest?.value(forHTTPHeaderField: "Authorization"),
            "QuickEntry \(credential.credential)"
        )
        let body = try XCTUnwrap(observedRequest?.httpBody)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: Any]
        )
        XCTAssertEqual(json["action"] as? String, "quickEntryBootstrap")
    }

    func testNativeQuickEntryServiceRetriesOneTransientCreateWithoutChangingIdentity() async throws {
        let credential = makeQuickEntryCredential()
        let endpoint = try XCTUnwrap(URL(string: "https://example.test/tasks-widget-actions"))
        let taskID = UUID()
        let accepted = TasksNativeQuickEntryReceipt(
            outcome: "accepted",
            taskId: taskID,
            revision: 1,
            acceptedAt: "2026-08-06T07:00:00.000Z",
            planningDate: "2026-08-06"
        )
        let acceptedData = try JSONEncoder().encode(accepted)
        var requests: [URLRequest] = []
        let service = TasksNativeQuickEntryService(
            endpoint: endpoint,
            credentialLoader: { credential },
            transport: { request in
                requests.append(request)
                let statusCode = requests.count == 1 ? 503 : 200
                return (
                    statusCode == 200 ? acceptedData : Data(),
                    HTTPURLResponse(
                        url: endpoint,
                        statusCode: statusCode,
                        httpVersion: nil,
                        headerFields: nil
                    )!
                )
            }
        )
        var draft = TasksNativeQuickEntryDraft(
            clientMutationID: UUID(),
            operationID: UUID()
        )
        draft.summary = "Capture complete metadata"
        let submission = try draft.normalizedSubmission(
            planningDate: try TasksNativeCalendarDate(year: 2026, month: 8, day: 6)
        )

        let result = try await service.create(submission)

        XCTAssertEqual(result, taskID)
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(requests[0].httpBody, requests[1].httpBody)
        let body = try XCTUnwrap(requests[0].httpBody)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: Any]
        )
        XCTAssertEqual(json["action"] as? String, "createQuickEntry")
        let payload = try XCTUnwrap(json["payload"] as? [String: Any])
        XCTAssertEqual(
            payload["clientMutationID"] as? String,
            submission.clientMutationID.uuidString
        )
        XCTAssertEqual(
            payload["operationID"] as? String,
            submission.operationID.uuidString
        )
    }

    func testNativeQuickEntryServiceRejectsExpiredAndUnauthorizedCredentials() async throws {
        let endpoint = try XCTUnwrap(URL(string: "https://example.test/tasks-widget-actions"))
        let expired = makeQuickEntryCredential(expiresAt: "2020-01-01T00:00:00.000Z")
        let expiredService = TasksNativeQuickEntryService(
            endpoint: endpoint,
            credentialLoader: {
                try expired.validate()
                return expired
            },
            transport: { _ in
                XCTFail("Expired authority must not reach the network")
                throw TasksNativeQuickEntryServiceFailure.unavailable
            }
        )
        await XCTAssertThrowsErrorAsync(try await expiredService.refreshBootstrap()) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryServiceFailure,
                .invalidCredential
            )
        }

        let credential = makeQuickEntryCredential()
        let unauthorizedService = TasksNativeQuickEntryService(
            endpoint: endpoint,
            credentialLoader: { credential },
            transport: { request in
                (
                    Data(),
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 401,
                        httpVersion: nil,
                        headerFields: nil
                    )!
                )
            }
        )
        await XCTAssertThrowsErrorAsync(try await unauthorizedService.refreshBootstrap()) {
            XCTAssertEqual(
                $0 as? TasksNativeQuickEntryServiceFailure,
                .invalidCredential
            )
        }
    }

    private func makeQuickEntryCredential(
        ownerID: UUID = UUID(),
        expiresAt: String = "2099-01-01T00:00:00.000Z"
    ) -> TasksNativeQuickEntryCredential {
        TasksNativeQuickEntryCredential(
            payloadSchemaVersion: TasksNativeQuickEntryContract.payloadSchemaVersion,
            contractFingerprint: TasksNativeQuickEntryContract.sourceFingerprint,
            capability: TasksNativeQuickEntryContract.capability,
            ownerId: ownerID,
            installationId: UUID(),
            credential: "tqe_\(String(repeating: "a", count: 43))",
            expiresAt: expiresAt
        )
    }

    private func makeQuickEntryBootstrap(
        ownerID: UUID
    ) -> TasksNativeQuickEntryBootstrap {
        TasksNativeQuickEntryBootstrap(
            outcome: "accepted",
            type: "nativeQuickEntryBootstrap",
            schemaVersion: TasksNativeQuickEntryContract.schemaVersion,
            payloadSchemaVersion: TasksNativeQuickEntryContract.payloadSchemaVersion,
            contractFingerprint: TasksNativeQuickEntryContract.sourceFingerprint,
            capability: TasksNativeQuickEntryContract.capability,
            ownerId: ownerID,
            generatedAt: "2026-08-06T07:00:00.000Z",
            planningDate: "2026-08-06",
            planningTimeZone: "America/Los_Angeles",
            areas: [
                TasksNativeQuickEntryArea(id: UUID(), name: "Household"),
            ],
            limits: .init(
                maximumChecklistItems: TasksNativeQuickEntryContract.maximumChecklistItems,
                maximumPayloadBytes: TasksNativeQuickEntryContract.maximumPayloadBytes
            )
        )
    }

    private func XCTAssertThrowsErrorAsync<T>(
        _ expression: @autoclosure () async throws -> T,
        _ errorHandler: (Error) -> Void = { _ in }
    ) async {
        do {
            _ = try await expression()
            XCTFail("Expected expression to throw")
        } catch {
            errorHandler(error)
        }
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
