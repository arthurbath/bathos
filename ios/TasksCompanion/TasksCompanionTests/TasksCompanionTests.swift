import Foundation
import WebKit
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
        XCTAssertTrue(encoded.contains("primaryLink"))
        XCTAssertFalse(encoded.contains("checklist"))
    }

    func testSnapshotAcceptsJavaScriptISO8601Timestamps() throws {
        let snapshot = makeSnapshot(
            ownerID: UUID(),
            generatedAt: "2026-07-28T10:37:45.123Z"
        )

        XCTAssertNoThrow(try snapshot.validate())
        XCTAssertNotNil(snapshot.generatedDate)
    }

    func testSnapshotRejectsUnexpectedListsAndOversizedRows() throws {
        let ownerID = UUID()
        let incomplete = TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: TaskWidgetSnapshot.schemaVersion,
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
            schemaVersion: TaskWidgetSnapshot.schemaVersion,
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

    func testStoreReplacesAnObsoleteSnapshotSchema() throws {
        let directory = temporaryDirectory()
        let store = TaskWidgetStore(directoryURL: directory)
        let current = makeSnapshot(ownerID: UUID())
        let obsolete = TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: 1,
            ownerId: UUID(),
            generatedAt: "2026-07-27T08:00:00Z",
            planningDate: "2026-07-27",
            lists: current.lists
        )
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        try JSONEncoder().encode(obsolete).write(to: store.fileURL, options: .atomic)

        XCTAssertTrue(try store.store(current))
        XCTAssertEqual(try store.load(), current)
    }

    func testPrimaryLinkAllowsOnlyTheDeclaredMailOrWebProtocol() {
        XCTAssertNotNil(TaskWidgetPrimaryLink(
            href: "message://synthetic-message",
            kind: .mail
        ).url)
        XCTAssertNotNil(TaskWidgetPrimaryLink(
            href: "https://example.test/read",
            kind: .link
        ).url)
        XCTAssertNil(TaskWidgetPrimaryLink(
            href: "javascript:alert(1)",
            kind: .link
        ).url)
        XCTAssertNil(TaskWidgetPrimaryLink(
            href: "https://example.test/read",
            kind: .mail
        ).url)
    }

    func testCredentialStorePersistsOnlyAValidUnexpiredCapability() throws {
        let directory = temporaryDirectory()
        let store = TaskWidgetCredentialStore(directoryURL: directory)
        let credential = TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: UUID(),
            installationId: UUID(),
            credential: "twc_" + String(repeating: "A", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        try store.store(credential)
        XCTAssertEqual(
            try store.load(now: Date(timeIntervalSince1970: 0)),
            credential
        )
        XCTAssertThrowsError(try store.load(
            now: Date(timeIntervalSince1970: 4_102_444_800)
        ))
        XCTAssertTrue(try store.clear())
    }

    func testCompletionClientUsesTheNarrowCredentialAndBoundedRequest() async throws {
        let taskID = UUID(uuidString: "10c452c2-5767-4c0d-87ff-ab9fbc12ea25")!
        let mutationID = UUID(uuidString: "20c452c2-5767-4c0d-87ff-ab9fbc12ea25")!
        let operationID = UUID(uuidString: "30c452c2-5767-4c0d-87ff-ab9fbc12ea25")!
        let credential = TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: UUID(),
            installationId: UUID(),
            credential: "twc_" + String(repeating: "A", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        var capturedRequest: URLRequest?
        let client = TaskWidgetCompletionClient { request in
            capturedRequest = request
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (
                Data(#"{"outcome":"accepted","completed_at":"2026-07-28T22:00:00.123Z"}"#.utf8),
                response
            )
        }

        let result = await client.complete(
            taskID: taskID,
            credential: credential,
            clientMutationID: mutationID,
            operationID: operationID
        )

        XCTAssertEqual(result, TaskWidgetCompletionResult(
            outcome: "accepted",
            completedAt: "2026-07-28T22:00:00.123Z"
        ))
        XCTAssertEqual(capturedRequest?.timeoutInterval, 5)
        XCTAssertEqual(
            capturedRequest?.value(forHTTPHeaderField: "Authorization"),
            "Widget \(credential.credential)"
        )
        let body = try XCTUnwrap(capturedRequest?.httpBody)
        let payload = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: String]
        )
        XCTAssertEqual(payload["action"], "complete")
        XCTAssertEqual(payload["taskId"], taskID.uuidString.lowercased())
        XCTAssertEqual(payload["clientMutationId"], mutationID.uuidString.lowercased())
        XCTAssertEqual(payload["operationId"], operationID.uuidString.lowercased())
    }

    func testCompletionClientAcceptsRetryOutcomeAndRetainsFailure() async {
        let credential = TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: UUID(),
            installationId: UUID(),
            credential: "twc_" + String(repeating: "A", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        let response = HTTPURLResponse(
            url: TaskCompanionConstants.widgetActionsURL,
            statusCode: 200,
            httpVersion: nil,
            headerFields: nil
        )!
        let retryClient = TaskWidgetCompletionClient { _ in
            (Data(#"{"outcome":"already_applied"}"#.utf8), response)
        }
        let retryResult = await retryClient.complete(
            taskID: UUID(),
            credential: credential
        )
        XCTAssertEqual(retryResult?.outcome, "already_applied")

        let timeoutClient = TaskWidgetCompletionClient { _ in
            throw URLError(.timedOut)
        }
        let timeoutResult = await timeoutClient.complete(
            taskID: UUID(),
            credential: credential
        )
        XCTAssertNil(timeoutResult)
    }

    func testCompletionClientRetriesTransientFailureWithStableIdentifiers() async {
        let credential = TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: UUID(),
            installationId: UUID(),
            credential: "twc_" + String(repeating: "A", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        var requests: [URLRequest] = []
        let client = TaskWidgetCompletionClient { request in
            requests.append(request)
            if requests.count == 1 {
                throw URLError(.timedOut)
            }
            return (
                Data(#"{"outcome":"accepted"}"#.utf8),
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: nil
                )!
            )
        }

        let result = await client.complete(
            taskID: UUID(),
            credential: credential
        )

        XCTAssertEqual(result?.outcome, "accepted")
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(requests[0].httpBody, requests[1].httpBody)
    }

    func testCompletionClientDoesNotRetryRejectedCredential() async {
        let credential = TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: UUID(),
            installationId: UUID(),
            credential: "twc_" + String(repeating: "A", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        var requestCount = 0
        let client = TaskWidgetCompletionClient { request in
            requestCount += 1
            return (
                Data(),
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 401,
                    httpVersion: nil,
                    headerFields: nil
                )!
            )
        }

        let result = await client.complete(
            taskID: UUID(),
            credential: credential
        )

        XCTAssertNil(result)
        XCTAssertEqual(requestCount, 1)
    }

    func testSuccessfulCompletionReconcilesEveryActiveListAndDone() throws {
        let taskID = UUID(uuidString: "10c452c2-5767-4c0d-87ff-ab9fbc12ea25")!
        var snapshot = makeSnapshot(ownerID: UUID())
        snapshot.lists[2] = TaskWidgetList(
            id: .anytime,
            title: "Anytime",
            totalCount: 1,
            truncated: false,
            tasks: snapshot.lists[0].tasks
        )
        XCTAssertTrue(snapshot.completeTask(
            taskID,
            completedAt: "2026-07-28T12:00:00Z"
        ))
        XCTAssertTrue(snapshot.list(.today)?.tasks.isEmpty == true)
        XCTAssertTrue(snapshot.list(.anytime)?.tasks.isEmpty == true)
        XCTAssertEqual(snapshot.list(.done)?.tasks.first?.id, taskID)
        XCTAssertEqual(snapshot.list(.done)?.tasks.first?.terminalState, "completed")
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
            TaskNativeRoute.parse(URL(string: "bathostasks://new")!),
            .newTask
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://new/other")!),
            .list(.today)
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://new?placement=next")!),
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
        XCTAssertEqual(
            TaskNativeRoute.newTask.webURL.absoluteString,
            "https://os.bath.garden/tasks/today?native_new_task=1"
        )
        XCTAssertEqual(
            TaskNativeRoute.newTask.deepLinkURL.absoluteString,
            "bathostasks://new"
        )
        XCTAssertEqual(
            TaskCompanionURLAction.resolve(
                URL(string: "bathostasks://task/\(taskID.uuidString)?list=anytime")!
            ),
            .task(.task(taskID, list: .anytime))
        )
        XCTAssertEqual(
            TaskCompanionURLAction.resolve(URL(string: "https://example.test/read")!),
            .external(URL(string: "https://example.test/read")!)
        )
        XCTAssertEqual(
            TaskCompanionURLAction.resolve(URL(string: "message://synthetic-message")!),
            .external(URL(string: "message://synthetic-message")!)
        )
        XCTAssertEqual(
            TaskCompanionURLAction.resolve(URL(string: "javascript:alert(1)")!),
            .ignore
        )
    }

    func testCompletionIntentIsAvailableToTheContainingAppTarget() {
        let intent = CompleteTaskIntent(
            taskID: "10c452c2-5767-4c0d-87ff-ab9fbc12ea25"
        )

        XCTAssertEqual(intent.taskID, "10c452c2-5767-4c0d-87ff-ab9fbc12ea25")
        XCTAssertFalse(intent.value)
        XCTAssertFalse(CompleteTaskIntent.openAppWhenRun)
    }

    func testNewTaskControlIntentIsAvailableToTheContainingAppTarget() {
        if #available(iOS 18.0, *) {
            let intent = OpenNewTaskIntent(target: .todayInbox)

            XCTAssertEqual(intent.target, .todayInbox)
        }
    }

    func testNewTaskControlRequestStoreConsumesOneValidRequestOnce() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directoryURL) }
        let store = NewTaskControlRequestStore(directoryURL: directoryURL)
        let identifier = UUID(uuidString: "53a4b5c1-3a4e-4fab-a5bf-4c1b114fc690")!

        XCTAssertFalse(try store.consume())
        try store.record(identifier: identifier)
        XCTAssertEqual(
            try String(contentsOf: store.fileURL, encoding: .utf8),
            identifier.uuidString.lowercased()
        )
        XCTAssertTrue(try store.consume())
        XCTAssertFalse(try store.consume())
    }

    func testNewTaskControlRequestStoreRejectsAndClearsMalformedData() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directoryURL) }
        let store = NewTaskControlRequestStore(directoryURL: directoryURL)
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        try Data("not-a-control-request".utf8).write(to: store.fileURL)

        XCTAssertThrowsError(try store.consume())
        XCTAssertFalse(FileManager.default.fileExists(atPath: store.fileURL.path))
    }

    func testWidgetConfigurationExcludesDoneAndRejectsLegacyDoneSelection() {
        XCTAssertEqual(
            TaskWidgetListID.widgetConfigurationCases.map(\.title),
            ["Today", "Upcoming", "Anytime", "Someday"]
        )
        XCTAssertEqual(TaskWidgetListID.widgetConfigurationValue("Upcoming"), .upcoming)
        XCTAssertEqual(TaskWidgetListID.widgetConfigurationValue("Done"), .today)
        XCTAssertEqual(TaskWidgetListID.widgetConfigurationValue(nil), .today)
    }

    func testLockScreenPresentationUsesThreeLeadingTasks() {
        let tasks = [
            TaskWidgetTask(
                id: UUID(),
                summary: "First",
                deadline: nil,
                todaySection: nil,
                actionability: "actionable",
                terminalState: nil
            ),
            TaskWidgetTask(
                id: UUID(),
                summary: "Second",
                deadline: nil,
                todaySection: nil,
                actionability: "actionable",
                terminalState: nil
            ),
            TaskWidgetTask(
                id: UUID(),
                summary: "Third",
                deadline: nil,
                todaySection: nil,
                actionability: "actionable",
                terminalState: nil
            ),
            TaskWidgetTask(
                id: UUID(),
                summary: "Fourth",
                deadline: nil,
                todaySection: nil,
                actionability: "actionable",
                terminalState: nil
            ),
        ]

        XCTAssertEqual(TaskWidgetPresentationPolicy.lockScreenTaskLimit, 3)
        XCTAssertEqual(
            TaskWidgetPresentationPolicy.lockScreenTaskRowMinimumHeight,
            16
        )
        XCTAssertEqual(
            TaskWidgetPresentationPolicy.lockScreenTaskRowSpacing,
            4
        )
        XCTAssertEqual(
            tasks.prefix(
                TaskWidgetPresentationPolicy.lockScreenTaskLimit
            ).map(\.summary),
            ["First", "Second", "Third"]
        )
        XCTAssertTrue(
            TaskWidgetPresentationPolicy.verticallyCentersLockScreenTasks(
                taskCount: 3
            )
        )
        XCTAssertFalse(
            TaskWidgetPresentationPolicy.verticallyCentersLockScreenTasks(
                taskCount: 2
            )
        )
    }

    func testLockScreenDeepLinkTargetsConfiguredList() {
        let url = TaskWidgetPresentationPolicy.lockScreenURL(for: .someday)

        XCTAssertEqual(url.absoluteString, "bathostasks://list/someday")
        XCTAssertEqual(TaskNativeRoute.parse(url), .list(.someday))
    }

    func testWebViewUsesPersistentAppBoundConfiguration() {
        let configuration = WKWebViewConfiguration()

        TasksWebViewPolicy.apply(to: configuration)

        XCTAssertTrue(configuration.limitsNavigationsToAppBoundDomains)
        XCTAssertTrue(configuration.websiteDataStore === WKWebsiteDataStore.default())
        XCTAssertEqual(
            Bundle.main.object(forInfoDictionaryKey: "WKAppBoundDomains") as? [String],
            [TaskCompanionConstants.trustedWebHost]
        )
    }

    func testWebNavigationPolicyKeepsTasksAndRequiredPlatformRoutesInternal() {
        let internalURLs = [
            "https://os.bath.garden/tasks/today",
            "https://os.bath.garden/tasks/config?source=native",
            "https://os.bath.garden/account",
            "https://os.bath.garden/signin",
            "https://os.bath.garden/signup",
            "https://os.bath.garden/forgot-password",
            "https://os.bath.garden/reset-password",
            "https://os.bath.garden/terms",
            "https://os.bath.garden/help",
            "https://os.bath.garden/.lovable/oauth/consent",
            "about:blank",
        ]

        for urlString in internalURLs {
            XCTAssertEqual(
                TasksWebNavigationPolicy.disposition(for: URL(string: urlString)!),
                .allow,
                urlString
            )
        }
    }

    func testWebNavigationPolicyEjectsLauncherModulesAdminAndExternalDestinations() {
        let externalURLs = [
            "https://os.bath.garden/",
            "https://os.bath.garden/budget/summary",
            "https://os.bath.garden/drawers/plan",
            "https://os.bath.garden/garage/due",
            "https://os.bath.garden/snake/weights",
            "https://os.bath.garden/wardrobe/items",
            "https://os.bath.garden/admin",
            "https://example.test/read",
            "http://os.bath.garden/tasks/today",
            "message://synthetic-message",
            "mailto:person@example.test",
        ]

        for urlString in externalURLs {
            XCTAssertEqual(
                TasksWebNavigationPolicy.disposition(for: URL(string: urlString)!),
                .openExternally,
                urlString
            )
        }
    }

    @MainActor
    func testFinishedContentIgnoresAStaleFailureAndRecoversAfterTermination() {
        let model = TasksBrowserModel()
        model.didFinishLoading()
        XCTAssertTrue(model.hasLoadedContent)

        model.didFailLoading(URLError(.notConnectedToInternet))
        XCTAssertTrue(model.hasLoadedContent)

        model.didTerminateWebContent()
        XCTAssertFalse(model.hasLoadedContent)
        XCTAssertTrue(model.isLoading)
        XCTAssertNil(model.loadError)
    }

    @MainActor
    func testLoadedContentUsesInPageNavigationForAWidgetDeepLink() {
        var navigatedURL: URL?
        let model = TasksBrowserModel(
            inPageNavigator: { _, url in
                navigatedURL = url
            }
        )
        let webView = WKWebView()
        model.webView = webView
        model.didFinishLoading()
        let route = TaskNativeRoute.task(UUID(), list: .today)

        model.open(route)

        XCTAssertEqual(navigatedURL, route.webURL)
        XCTAssertEqual(model.requestedURL, route.webURL)
        XCTAssertTrue(model.hasLoadedContent)
        XCTAssertFalse(model.isLoading)
    }

    @MainActor
    func testInPageNavigationAcceptsNativeNewTaskRouteWithoutCrashing() {
        TasksBrowserModel.navigateInPage(
            WKWebView(),
            to: TaskNativeRoute.newTask.webURL
        )
    }

    @MainActor
    func testNewTaskSummaryFocusTargetsOnlyTheKnownDraftInput() {
        XCTAssertEqual(
            TasksBrowserModel.newTaskSummaryFocusMessageType,
            "focus-new-task-summary"
        )
        XCTAssertEqual(
            TasksBrowserModel.newTaskSummaryInputIdentifier,
            "task-title-task-draft:new"
        )
        XCTAssertTrue(
            TasksBrowserModel.newTaskSummaryFocusJavaScript.contains(
                #"getElementById("task-title-task-draft:new")"#
            )
        )
        XCTAssertTrue(
            TasksBrowserModel.newTaskSummaryFocusJavaScript.contains(
                "input.focus({ preventScroll: true })"
            )
        )
    }

    @MainActor
    func testCancelledReplacementNavigationDoesNotStartRecovery() {
        let model = TasksBrowserModel(
            coldStartRecoveryDelayNanoseconds: 60_000_000_000
        )

        model.didFailLoading(URLError(.cancelled))

        XCTAssertTrue(model.isLoading)
        XCTAssertFalse(model.hasLoadedContent)
        XCTAssertNil(model.loadError)
    }

    @MainActor
    func testColdStartNavigationRetriesOnceBeforeShowingUnavailable() {
        let model = TasksBrowserModel(
            coldStartRecoveryDelayNanoseconds: 60_000_000_000
        )
        let loadError = URLError(.notConnectedToInternet)

        model.didFailLoading(loadError)

        XCTAssertTrue(model.isLoading)
        XCTAssertFalse(model.hasLoadedContent)
        XCTAssertNil(model.loadError)

        model.performColdStartRecovery()
        model.didFailLoading(loadError)

        XCTAssertFalse(model.isLoading)
        XCTAssertFalse(model.hasLoadedContent)
        XCTAssertEqual(model.loadError, loadError.localizedDescription)
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
            terminalState: nil,
            primaryLink: TaskWidgetPrimaryLink(
                href: "https://example.test/read",
                kind: .link
            )
        )
        return TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: TaskWidgetSnapshot.schemaVersion,
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
