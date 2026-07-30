import AppKit
import XCTest
@testable import TasksMac

@MainActor
final class TasksMacTests: XCTestCase {
    func testWindowPolicySupportsNarrowSplitViewPlacement() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1_100, height: 780),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )

        TasksMacWindowPolicy.apply(to: window)

        XCTAssertEqual(TasksMacWindowPolicy.minimumSize.width, 360)
        XCTAssertEqual(TasksMacWindowPolicy.minimumSize.height, 420)
        XCTAssertTrue(window.styleMask.contains(.resizable))
        XCTAssertTrue(window.collectionBehavior.contains(.fullScreenPrimary))
        XCTAssertEqual(window.minSize, TasksMacWindowPolicy.minimumSize)
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
