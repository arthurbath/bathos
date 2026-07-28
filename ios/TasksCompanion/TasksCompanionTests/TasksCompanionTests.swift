import Foundation
import XCTest
@testable import TasksCompanion

final class TasksCompanionTests: XCTestCase {
    func testSnapshotAcceptsAllFiveBoundedListsWithoutPrivateFields() throws {
        let directory = temporaryDirectory()
        let store = TaskWidgetStore(directoryURL: directory)
        let snapshot = makeSnapshot(ownerID: UUID())

        XCTAssertTrue(try store.store(snapshot))
        XCTAssertFalse(try store.store(makeSnapshot(
            ownerID: snapshot.ownerId,
            generatedAt: "2026-07-28T08:30:00Z"
        )))
        XCTAssertEqual(try store.load(), snapshot)

        let encoded = String(
            data: try JSONEncoder().encode(snapshot),
            encoding: .utf8
        )!
        XCTAssertFalse(encoded.contains("notes"))
        XCTAssertFalse(encoded.contains("primaryLink"))
        XCTAssertFalse(encoded.contains("checklist"))
    }

    func testSnapshotRejectsUnexpectedListsAndOversizedRows() throws {
        let ownerID = UUID()
        let incomplete = TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: 1,
            ownerId: ownerID,
            generatedAt: "2026-07-28T08:00:00Z",
            planningDate: "2026-07-28",
            lists: [
                TaskWidgetList(
                    id: .today,
                    title: "Today",
                    totalCount: 0,
                    truncated: false,
                    tasks: []
                ),
            ]
        )
        XCTAssertThrowsError(try incomplete.validate())

        let tooLong = String(repeating: "x", count: 501)
        let invalidTask = TaskWidgetTask(
            id: UUID(),
            summary: tooLong,
            deadline: nil,
            todaySection: nil,
            actionability: "actionable",
            terminalState: nil
        )
        var lists = makeSnapshot(ownerID: ownerID).lists
        lists[0] = TaskWidgetList(
            id: .today,
            title: "Today",
            totalCount: 1,
            truncated: false,
            tasks: [invalidTask]
        )
        let invalid = TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: 1,
            ownerId: ownerID,
            generatedAt: "2026-07-28T08:00:00Z",
            planningDate: "2026-07-28",
            lists: lists
        )
        XCTAssertThrowsError(try invalid.validate())
    }

    func testStoreAtomicallyReplacesAFormerOwnerAndClears() throws {
        let directory = temporaryDirectory()
        let store = TaskWidgetStore(directoryURL: directory)
        let first = makeSnapshot(ownerID: UUID())
        let second = makeSnapshot(ownerID: UUID())

        XCTAssertTrue(try store.store(first))
        XCTAssertTrue(try store.store(second))
        XCTAssertEqual(try store.load()?.ownerId, second.ownerId)
        XCTAssertTrue(try store.clear())
        XCTAssertNil(try store.load())
        XCTAssertFalse(try store.clear())
    }

    func testRouteParsingIsAllowlistedAndProducesProductionURLs() {
        let taskID = UUID(uuidString: "53a4b5c1-3a4e-4fab-a5bf-4c1b114fc690")!
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://list/upcoming")!),
            .list(.upcoming)
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(
                URL(string: "bathostasks://task/\(taskID.uuidString)?list=anytime")!
            ),
            .task(taskID, list: .anytime)
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://list/private")!),
            .list(.today)
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "https://example.com/tasks/done")!),
            .list(.today)
        )
        XCTAssertEqual(
            TaskNativeRoute.task(taskID, list: .done).webURL.absoluteString,
            "https://os.bath.garden/tasks/done?native_task=\(taskID.uuidString.lowercased())"
        )
    }

    private func makeSnapshot(
        ownerID: UUID,
        generatedAt: String = "2026-07-28T08:00:00Z"
    ) -> TaskWidgetSnapshot {
        let task = TaskWidgetTask(
            id: UUID(uuidString: "10c452c2-5767-4c0d-87ff-ab9fbc12ea25")!,
            summary: "Private task summary",
            deadline: "2026-07-28",
            todaySection: "inbox",
            actionability: "actionable",
            terminalState: nil
        )
        return TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: 1,
            ownerId: ownerID,
            generatedAt: generatedAt,
            planningDate: "2026-07-28",
            lists: TaskWidgetListID.allCases.map { id in
                TaskWidgetList(
                    id: id,
                    title: id.title,
                    totalCount: id == .today ? 1 : 0,
                    truncated: false,
                    tasks: id == .today ? [task] : []
                )
            }
        )
    }

    private func temporaryDirectory() -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        addTeardownBlock {
            try? FileManager.default.removeItem(at: directory)
        }
        return directory
    }
}
