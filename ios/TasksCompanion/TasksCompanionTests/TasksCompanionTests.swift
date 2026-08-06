import Foundation
import UserNotifications
import WebKit
import XCTest
@testable import TasksCompanion

final class TasksCompanionTests: XCTestCase {
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

    func testNativeReminderProjectionKeepsTheEarliestFutureItems() throws {
        let now = try XCTUnwrap(
            ISO8601DateFormatter().date(from: "2026-08-06T16:00:00Z")
        )
        let ownerID = UUID()
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
        let past = TaskNativeReminderProjectionItem(
            id: UUID(),
            taskId: UUID(),
            summary: "Past",
            resolvedAt: "2026-08-06T15:00:00Z"
        )
        let projection = TaskNativeReminderProjection(
            ownerId: ownerID,
            generatedAt: "2026-08-06T16:00:00Z",
            reminders: [second, past, first]
        )

        XCTAssertTrue(projection.isValid)
        XCTAssertEqual(projection.scheduledItems(after: now, limit: 1), [first])
        XCTAssertTrue(
            TaskNativeNotificationCoordinator.notificationIdentifier(
                ownerId: ownerID,
                reminderId: first.id
            ).hasPrefix(TaskNativeNotificationCoordinator.identifierPrefix)
        )

        let request = try XCTUnwrap(
            TaskNativeNotificationCoordinator.notificationRequest(
                ownerId: ownerID,
                item: first,
                now: now
            )
        )
        XCTAssertEqual(request.content.title, "Reminder")
        XCTAssertEqual(request.content.body, "First")
        XCTAssertEqual(
            request.content.userInfo["taskId"] as? String,
            first.taskId.uuidString.lowercased()
        )
        let trigger = try XCTUnwrap(request.trigger as? UNTimeIntervalNotificationTrigger)
        XCTAssertEqual(trigger.timeInterval, 3_600, accuracy: 0.001)

        let invalidProjection = TaskNativeReminderProjection(
            ownerId: ownerID,
            generatedAt: "2026-08-06T16:00:00.000Z",
            reminders: [TaskNativeReminderProjectionItem(
                id: UUID(),
                taskId: UUID(),
                summary: "   ",
                resolvedAt: "2026-08-06T17:00:00.000Z"
            )]
        )
        XCTAssertFalse(invalidProjection.isValid)
    }

    func testWatchComplicationCaptureRouteIsExact() {
        XCTAssertEqual(
            TaskWatchCaptureLaunchPolicy.captureURL.absoluteString,
            "bathostasks-watch://capture"
        )
        XCTAssertTrue(TaskWatchCaptureLaunchPolicy.shouldBeginCapture(
            for: TaskWatchCaptureLaunchPolicy.captureURL
        ))

        for urlString in [
            "bathostasks-watch://capture/other",
            "bathostasks-watch://capture?source=other",
            "bathostasks-watch://other",
            "bathostasks://capture",
            "https://os.bath.garden/tasks/today",
        ] {
            XCTAssertFalse(TaskWatchCaptureLaunchPolicy.shouldBeginCapture(
                for: URL(string: urlString)!
            ), urlString)
        }
    }

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
        XCTAssertNotNil(TaskWidgetPrimaryLink(
            href: "jira://issue/PF-766",
            kind: .link
        ).url)
        XCTAssertNotNil(TaskWidgetPrimaryLink(
            href: "obsidian://open?vault=Personal",
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

    func testPrimaryLinkUsesProtocolSpecificWidgetIconography() {
        let mail = TaskWidgetPrimaryLink(
            href: "message://synthetic-message",
            kind: .mail
        )
        let jiraProtocol = TaskWidgetPrimaryLink(
            href: "jira://issue/PF-766",
            kind: .link
        )
        let jiraURL = TaskWidgetPrimaryLink(
            href: "https://usgbc.atlassian.net/browse/PF-766",
            kind: .link
        )
        let confluenceURL = TaskWidgetPrimaryLink(
            href: "https://usgbc.atlassian.net/wiki/spaces/PF",
            kind: .link
        )
        let obsidian = TaskWidgetPrimaryLink(
            href: "obsidian://open?vault=Personal",
            kind: .link
        )

        XCTAssertEqual(mail.iconKind, .mail)
        XCTAssertEqual(jiraProtocol.iconKind, .jira)
        XCTAssertEqual(jiraURL.iconKind, .jira)
        XCTAssertEqual(confluenceURL.iconKind, .link)
        XCTAssertEqual(obsidian.iconKind, .obsidian)
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

    func testWatchCredentialRecoveryPayloadContainsNoTaskContent() {
        let requestID = UUID(
            uuidString: "ac000000-0000-4000-8000-000000000001"
        )!
        let payload = TaskWatchConnectivityMessage.credentialRequest(
            identifier: requestID
        )

        XCTAssertTrue(TaskWatchConnectivityMessage.isCredentialRequest(payload))
        XCTAssertEqual(payload["requestId"] as? String, requestID.uuidString.lowercased())
        XCTAssertNil(payload["summary"])
        XCTAssertNil(payload["task"])
    }

    func testWatchProgressFractionCoversEmptyPartialAndCompleteStates() throws {
        let ownerID = UUID()
        let generatedAt = "2099-10-26T12:00:00.123Z"
        let planningDate = "2099-10-26"

        let empty = TaskWatchTodayProgress(
            type: "todayProgress",
            schemaVersion: TaskWatchTodayProgress.schemaVersion,
            ownerId: ownerID,
            generatedAt: generatedAt,
            planningDate: planningDate,
            completedCount: 0,
            totalCount: 0
        )
        let partial = TaskWatchTodayProgress(
            type: "todayProgress",
            schemaVersion: TaskWatchTodayProgress.schemaVersion,
            ownerId: ownerID,
            generatedAt: generatedAt,
            planningDate: planningDate,
            completedCount: 2,
            totalCount: 4
        )
        let complete = TaskWatchTodayProgress(
            type: "todayProgress",
            schemaVersion: TaskWatchTodayProgress.schemaVersion,
            ownerId: ownerID,
            generatedAt: generatedAt,
            planningDate: planningDate,
            completedCount: 4,
            totalCount: 4
        )

        XCTAssertEqual(empty.fraction, 0)
        XCTAssertEqual(partial.fraction, 0.5)
        XCTAssertEqual(complete.fraction, 1)
    }

    func testWatchCredentialResponseRoundTripsTheNarrowCapability() {
        let credential = TaskWatchCredential(
            schemaVersion: TaskWatchCredential.schemaVersion,
            ownerId: UUID(),
            credential: "twc_" + String(repeating: "W", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        let payload = TaskWatchConnectivityMessage.credentialPayload(credential)

        XCTAssertEqual(
            TaskWatchConnectivityMessage.credential(from: payload),
            credential
        )
        XCTAssertNil(payload["summary"])
    }

    func testWatchCapturePostsDirectlyWithStableMutationIdentifiers() async throws {
        let credential = TaskWatchCredential(
            schemaVersion: TaskWatchCredential.schemaVersion,
            ownerId: UUID(),
            credential: "twc_" + String(repeating: "W", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        let clientMutationID = UUID(
            uuidString: "ac000000-0000-4000-8000-000000000002"
        )!
        let operationID = UUID(
            uuidString: "ac000000-0000-4000-8000-000000000003"
        )!
        var capturedRequest: URLRequest?
        let client = TaskWatchActionsClient { request in
            capturedRequest = request
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

        try await client.createInboxTask(
            summary: "Watch capture",
            credential: credential,
            clientMutationId: clientMutationID,
            operationId: operationID
        )

        XCTAssertEqual(capturedRequest?.url, TaskCompanionConstants.widgetActionsURL)
        XCTAssertEqual(
            capturedRequest?.value(forHTTPHeaderField: "Authorization"),
            "Widget \(credential.credential)"
        )
        let body = try XCTUnwrap(capturedRequest?.httpBody)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: String]
        )
        XCTAssertEqual(object["action"], "createInboxTask")
        XCTAssertEqual(object["summary"], "Watch capture")
        XCTAssertEqual(object["clientMutationId"], clientMutationID.uuidString.lowercased())
        XCTAssertEqual(object["operationId"], operationID.uuidString.lowercased())
    }

    func testSnapshotClientUsesTheNarrowCredentialAndValidatesTheOwner() async throws {
        let ownerID = UUID(uuidString: "9b000000-0000-4000-8000-000000000001")!
        let credential = TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: ownerID,
            installationId: UUID(),
            credential: "twc_" + String(repeating: "A", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        let expected = makeSnapshot(
            ownerID: ownerID,
            generatedAt: "2026-07-29T21:00:00.123Z"
        )
        var capturedRequest: URLRequest?
        let client = TaskWidgetSnapshotClient { request in
            capturedRequest = request
            return (
                try JSONEncoder().encode(expected),
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: nil
                )!
            )
        }

        let result = await client.fetch(credential: credential)

        XCTAssertEqual(result, expected)
        XCTAssertEqual(capturedRequest?.timeoutInterval, 8)
        XCTAssertEqual(
            capturedRequest?.value(forHTTPHeaderField: "Authorization"),
            "Widget \(credential.credential)"
        )
        let body = try XCTUnwrap(capturedRequest?.httpBody)
        XCTAssertEqual(
            try JSONSerialization.jsonObject(with: body) as? [String: String],
            ["action": "snapshot"]
        )

        let foreignClient = TaskWidgetSnapshotClient { request in
            (
                try JSONEncoder().encode(self.makeSnapshot(ownerID: UUID())),
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: nil
                )!
            )
        }
        let foreignResult = await foreignClient.fetch(credential: credential)
        XCTAssertNil(foreignResult)
    }

    func testBackgroundRefresherPersistsFreshContentAndFallsBackToCache() async throws {
        let directory = temporaryDirectory()
        let snapshotStore = TaskWidgetStore(directoryURL: directory)
        let credentialStore = TaskWidgetCredentialStore(directoryURL: directory)
        let ownerID = UUID(uuidString: "9b000000-0000-4000-8000-000000000001")!
        let credential = TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: ownerID,
            installationId: UUID(),
            credential: "twc_" + String(repeating: "A", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        try credentialStore.store(credential)
        let cached = makeSnapshot(ownerID: ownerID)
        _ = try snapshotStore.store(cached)

        var refreshed = makeSnapshot(
            ownerID: ownerID,
            generatedAt: "2026-07-29T21:00:00.123Z"
        )
        let refreshedTask = TaskWidgetTask(
            id: refreshed.lists[0].tasks[0].id,
            summary: "Refreshed task summary",
            deadline: "2026-07-29",
            todaySection: "inbox",
            actionability: "waiting",
            terminalState: nil
        )
        refreshed.lists[0] = TaskWidgetList(
            id: .today,
            title: "Today",
            totalCount: 1,
            truncated: false,
            tasks: [refreshedTask]
        )
        let response = HTTPURLResponse(
            url: TaskCompanionConstants.widgetActionsURL,
            statusCode: 200,
            httpVersion: nil,
            headerFields: nil
        )!
        let successful = TaskWidgetBackgroundRefresher(
            credentialStore: credentialStore,
            snapshotStore: snapshotStore,
            client: TaskWidgetSnapshotClient { _ in
                (try JSONEncoder().encode(refreshed), response)
            }
        )

        let successfulResult = await successful.refresh()
        XCTAssertEqual(successfulResult, refreshed)
        XCTAssertEqual(try snapshotStore.load(), refreshed)

        let offline = TaskWidgetBackgroundRefresher(
            credentialStore: credentialStore,
            snapshotStore: snapshotStore,
            client: TaskWidgetSnapshotClient { _ in
                throw URLError(.notConnectedToInternet)
            }
        )
        let offlineResult = await offline.refresh()
        XCTAssertEqual(offlineResult, refreshed)
    }

    func testSnapshotClientRetriesTransientFailureButNotMalformedContent() async {
        let ownerID = UUID(uuidString: "9b000000-0000-4000-8000-000000000001")!
        let credential = TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: ownerID,
            installationId: UUID(),
            credential: "twc_" + String(repeating: "A", count: 43),
            expiresAt: "2099-10-26T12:00:00.123Z"
        )
        let snapshot = makeSnapshot(ownerID: ownerID)
        var retryCount = 0
        let retrying = TaskWidgetSnapshotClient { request in
            retryCount += 1
            let statusCode = retryCount == 1 ? 503 : 200
            return (
                try JSONEncoder().encode(snapshot),
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: statusCode,
                    httpVersion: nil,
                    headerFields: nil
                )!
            )
        }

        let retryResult = await retrying.fetch(credential: credential)
        XCTAssertEqual(retryResult, snapshot)
        XCTAssertEqual(retryCount, 2)

        var malformedCount = 0
        let malformed = TaskWidgetSnapshotClient { request in
            malformedCount += 1
            return (
                Data(#"{"type":"snapshot","schemaVersion":2}"#.utf8),
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: nil
                )!
            )
        }
        let malformedResult = await malformed.fetch(credential: credential)
        XCTAssertNil(malformedResult)
        XCTAssertEqual(malformedCount, 1)
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
            TaskNativeRoute.parse(URL(string: "bathostasks://new/upcoming")!),
            .newTaskInList(.upcoming)
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://new/other")!),
            .list(.today)
        )
        XCTAssertEqual(
            TaskNativeRoute.parse(URL(string: "bathostasks://new/upcoming/other")!),
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
            TaskNativeRoute.newTaskInList(.someday).webURL.absoluteString,
            "https://os.bath.garden/tasks/someday?native_new_task=list"
        )
        XCTAssertEqual(
            TaskNativeRoute.newTaskInList(.someday).deepLinkURL.absoluteString,
            "bathostasks://new/someday"
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
            TaskCompanionURLAction.resolve(URL(string: "jira://issue/PF-766")!),
            .external(URL(string: "jira://issue/PF-766")!)
        )
        XCTAssertEqual(
            TaskCompanionURLAction.resolve(URL(string: "obsidian://open?vault=Personal")!),
            .external(URL(string: "obsidian://open?vault=Personal")!)
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
        XCTAssertEqual(TaskWidgetPresentationPolicy.lockScreenTaskFontSize, 13)
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

    func testLargeWidgetAlwaysCapsVisibleTasksAtTen() {
        XCTAssertEqual(
            TaskWidgetPresentationPolicy.largeWidgetTaskLimit,
            10
        )
        XCTAssertEqual(
            TaskWidgetPresentationPolicy.largeWidgetTaskRowMinimumHeight,
            29
        )
    }

    func testUpcomingWidgetLabelsUseWeekdaysBeforeTheSevenDayBoundary() {
        let locale = Locale(identifier: "en_US")

        XCTAssertEqual(
            TaskWidgetPresentationPolicy.upcomingDateLabel(
                upcomingDate: "2026-07-31",
                planningDate: "2026-07-30",
                locale: locale
            ),
            "Fri"
        )
        XCTAssertEqual(
            TaskWidgetPresentationPolicy.upcomingDateLabel(
                upcomingDate: "2026-08-05",
                planningDate: "2026-07-30",
                locale: locale
            ),
            "Wed"
        )
        XCTAssertEqual(
            TaskWidgetPresentationPolicy.upcomingDateLabel(
                upcomingDate: "2026-08-06",
                planningDate: "2026-07-30",
                locale: locale
            ),
            "Aug 6"
        )
    }

    func testSnapshotValidatesUpcomingRecurrencePresentationOnlyInUpcoming() throws {
        let ownerID = UUID()
        let projection = TaskWidgetTask(
            id: UUID(),
            summary: "Repeating Schedule",
            deadline: nil,
            todaySection: nil,
            actionability: "actionable",
            terminalState: nil,
            upcomingDate: "2026-08-31",
            isRecurrenceProjection: true
        )
        var validLists = makeSnapshot(ownerID: ownerID).lists
        validLists[1] = TaskWidgetList(
            id: .upcoming,
            title: "Upcoming",
            totalCount: 1,
            truncated: false,
            tasks: [projection]
        )
        let valid = TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: TaskWidgetSnapshot.schemaVersion,
            ownerId: ownerID,
            generatedAt: "2026-07-30T08:00:00Z",
            planningDate: "2026-07-30",
            lists: validLists
        )
        XCTAssertNoThrow(try valid.validate())

        validLists[0] = TaskWidgetList(
            id: .today,
            title: "Today",
            totalCount: 1,
            truncated: false,
            tasks: [projection]
        )
        let invalid = TaskWidgetSnapshot(
            type: "snapshot",
            schemaVersion: TaskWidgetSnapshot.schemaVersion,
            ownerId: ownerID,
            generatedAt: "2026-07-30T08:00:00Z",
            planningDate: "2026-07-30",
            lists: validLists
        )
        XCTAssertThrowsError(try invalid.validate())
    }

    func testLargeWidgetNewTaskDeepLinkTargetsTodayInboxOrConfiguredList() {
        let todayURL = TaskWidgetPresentationPolicy.largeWidgetNewTaskURL(for: .today)

        XCTAssertEqual(todayURL, TaskNativeRoute.newTask.deepLinkURL)
        XCTAssertEqual(todayURL.absoluteString, "bathostasks://new")
        XCTAssertEqual(TaskNativeRoute.parse(todayURL), .newTask)

        for listID in [TaskWidgetListID.upcoming, .anytime, .someday] {
            let url = TaskWidgetPresentationPolicy.largeWidgetNewTaskURL(for: listID)

            XCTAssertEqual(url.absoluteString, "bathostasks://new/\(listID.rawValue)")
            XCTAssertEqual(TaskNativeRoute.parse(url), .newTaskInList(listID))
        }
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

    func testWebViewScrollPolicyPreservesNativeVerticalScrollingWithoutHorizontalBounce() {
        let scrollView = UIScrollView()
        scrollView.bounces = false
        scrollView.alwaysBounceVertical = false
        scrollView.alwaysBounceHorizontal = true
        scrollView.isDirectionalLockEnabled = false
        scrollView.contentInsetAdjustmentBehavior = .automatic

        TasksWebViewScrollPolicy.apply(to: scrollView)

        XCTAssertTrue(scrollView.bounces)
        XCTAssertTrue(scrollView.alwaysBounceVertical)
        XCTAssertFalse(scrollView.alwaysBounceHorizontal)
        XCTAssertTrue(scrollView.isDirectionalLockEnabled)
        XCTAssertEqual(scrollView.decelerationRate, .normal)
        XCTAssertEqual(scrollView.contentInsetAdjustmentBehavior, .never)
    }

    @MainActor
    func testTasksCommandWebViewMapsOnlyCompletedShakeMotionToUndo() {
        let webView = TasksCommandWebView(
            frame: .zero,
            configuration: WKWebViewConfiguration()
        )
        var shakeCount = 0
        webView.onShake = {
            shakeCount += 1
        }

        XCTAssertFalse(webView.handleCompletedMotion(.remoteControlPlay))
        XCTAssertEqual(shakeCount, 0)
        XCTAssertTrue(webView.handleCompletedMotion(.motionShake))
        XCTAssertEqual(shakeCount, 1)
        XCTAssertTrue(webView.handleCompletedMotion(.motionShake))
        XCTAssertEqual(shakeCount, 2)
    }

    @MainActor
    func testTaskUndoNativeCommandUsesTheVersionedTasksEvent() {
        XCTAssertTrue(
            TasksBrowserModel.taskUndoCommandJavaScript.contains(
                "bathos:tasks-native-command"
            )
        )
        XCTAssertTrue(
            TasksBrowserModel.taskUndoCommandJavaScript.contains(
                "schemaVersion: 1"
            )
        )
        XCTAssertTrue(
            TasksBrowserModel.taskUndoCommandJavaScript.contains(
                "command: \"undo\""
            )
        )
    }

    @MainActor
    func testNativeActivationRequestsAFreshTasksSyncStream() {
        XCTAssertTrue(
            TasksBrowserModel.nativeAppActiveJavaScript.contains(
                "bathos:tasks-native-app-active"
            )
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
        XCTAssertFalse(model.hasLoadedContent)
        model.didBecomeContentReady()
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
        model.didBecomeContentReady()
        let route = TaskNativeRoute.task(UUID(), list: .today)

        model.open(route)

        XCTAssertEqual(navigatedURL, route.webURL)
        XCTAssertEqual(model.requestedURL, route.webURL)
        XCTAssertTrue(model.hasLoadedContent)
        XCTAssertFalse(model.isLoading)
    }

    @MainActor
    func testNavigationWaitsForWebReadinessAndHasABoundedFallback() {
        let model = TasksBrowserModel(
            contentReadyFallbackDelayNanoseconds: 60_000_000_000
        )

        model.didFinishLoading()

        XCTAssertFalse(model.hasLoadedContent)
        XCTAssertTrue(model.isLoading)

        model.performContentReadyFallback()

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
            TasksBrowserModel.webTextInputEngagedMessageType,
            "web-text-input-engaged"
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
        XCTAssertTrue(
            TasksBrowserModel.newTaskSummaryValueJavaScript.contains(
                "input.value"
            )
        )
        XCTAssertTrue(
            TasksBrowserModel.submitNewTaskSummaryJavaScript.contains(
                #"key: "Enter""#
            )
        )
    }

    @MainActor
    func testNewTaskSummaryNativeKeyboardBridgeEscapesTextAsJavaScriptData() {
        let value = #"One "quoted" task \ line"#
        let script = TasksBrowserModel.updateNewTaskSummaryJavaScript(value)

        XCTAssertNotNil(script)
        XCTAssertTrue(script?.contains(#"One \"quoted\" task \\ line"#) == true)
        XCTAssertTrue(script?.contains("new InputEvent") == true)
        XCTAssertTrue(script?.contains("setSelectionRange") == true)
    }

    @MainActor
    func testCompanionBackgroundMatchesTheCanonicalBathOSSurface() {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0

        XCTAssertTrue(
            TasksCompanionAppearance.applicationBackground.getRed(
                &red,
                green: &green,
                blue: &blue,
                alpha: &alpha
            )
        )
        XCTAssertEqual(red, 13.0 / 255.0, accuracy: 0.0001)
        XCTAssertEqual(green, 13.0 / 255.0, accuracy: 0.0001)
        XCTAssertEqual(blue, 13.0 / 255.0, accuracy: 0.0001)
        XCTAssertEqual(alpha, 1, accuracy: 0.0001)
    }

    @MainActor
    func testNewTaskSummaryFocusActivatesWebKitOnlyAfterDOMFocusSucceeds() {
        var didActivateFirstResponder = false

        let activated = TasksBrowserModel.finishNewTaskSummaryFocus(
            result: true,
            error: nil,
            activateFirstResponder: {
                didActivateFirstResponder = true
                return true
            }
        )

        XCTAssertTrue(activated)
        XCTAssertTrue(didActivateFirstResponder)
    }

    @MainActor
    func testNewTaskSummaryFocusDoesNotActivateWebKitWhenDOMFocusFails() {
        var didActivateFirstResponder = false

        let activated = TasksBrowserModel.finishNewTaskSummaryFocus(
            result: false,
            error: nil,
            activateFirstResponder: {
                didActivateFirstResponder = true
                return true
            }
        )

        XCTAssertFalse(activated)
        XCTAssertFalse(didActivateFirstResponder)
    }

    @MainActor
    func testSummaryKeyboardPresenterRejectsAnotherWebViewAndWaitsForItsOwnWindow() {
        let presenter = TasksSummaryKeyboardPresenter()
        let attachedWebView = WKWebView()
        let unrelatedWebView = WKWebView()

        presenter.attach(to: attachedWebView)

        XCTAssertFalse(presenter.present(in: unrelatedWebView))
        XCTAssertTrue(presenter.present(in: attachedWebView))
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

    func testWidgetPushRegistrationStoreTracksTokenAndCredentialIdentity() throws {
        let directory = temporaryDirectory()
        let store = TaskWidgetPushRegistrationStore(directoryURL: directory)
        let owner = UUID()
        let installation = UUID()
        let credential = makeWidgetCredential(ownerID: owner, installationID: installation)
        let registration = makeWidgetPushRegistration(tokenCharacter: "a")

        try store.storePending(registration)
        XCTAssertEqual(try store.loadPending(), registration)
        XCTAssertFalse(store.isAccepted(registration, credential: credential))

        try store.markAccepted(registration, credential: credential)
        XCTAssertTrue(store.isAccepted(registration, credential: credential))
        XCTAssertFalse(
            store.isAccepted(
                registration,
                credential: makeWidgetCredential(
                    ownerID: UUID(),
                    installationID: installation
                )
            )
        )
        XCTAssertFalse(
            store.isAccepted(
                makeWidgetPushRegistration(tokenCharacter: "b"),
                credential: credential
            )
        )
    }

    func testWidgetPushRegistrationWaitsForCredentialThenRegisters() async throws {
        let directory = temporaryDirectory()
        let registrationStore = TaskWidgetPushRegistrationStore(directoryURL: directory)
        let credentialStore = TaskWidgetCredentialStore(directoryURL: directory)
        let registration = makeWidgetPushRegistration(tokenCharacter: "c")
        try registrationStore.storePending(registration)
        var requests = [URLRequest]()
        let client = TaskWidgetPushRegistrationClient(
            endpoint: URL(string: "https://example.test/tasks-widget-actions")!,
            transport: { request in
                requests.append(request)
                return (
                    try JSONSerialization.data(withJSONObject: ["outcome": "registered"]),
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 200,
                        httpVersion: nil,
                        headerFields: nil
                    )!
                )
            }
        )
        let synchronizer = TaskWidgetPushRegistrationSynchronizer(
            registrationStore: registrationStore,
            credentialStore: credentialStore,
            client: client
        )

        await synchronizer.synchronize()
        XCTAssertTrue(requests.isEmpty)

        let credential = makeWidgetCredential()
        try credentialStore.store(credential)
        await synchronizer.synchronize()
        XCTAssertEqual(requests.count, 1)
        XCTAssertTrue(registrationStore.isAccepted(registration, credential: credential))
        XCTAssertEqual(
            requests[0].value(forHTTPHeaderField: "Authorization"),
            "Widget \(credential.credential)"
        )
    }

    func testWidgetPushDisablementUsesTheRegistrationAction() async throws {
        let registration = TaskWidgetPushRegistration(
            schemaVersion: TaskWidgetPushRegistration.schemaVersion,
            deviceToken: String(repeating: "d", count: 64),
            platform: "ios",
            environment: "development",
            topic: "garden.bath.tasks.push-type.widgets",
            enabled: false
        )
        var capturedBody: [String: Any] = [:]
        let client = TaskWidgetPushRegistrationClient(
            endpoint: URL(string: "https://example.test/tasks-widget-actions")!,
            transport: { request in
                capturedBody = try XCTUnwrap(
                    JSONSerialization.jsonObject(with: request.httpBody!) as? [String: Any]
                )
                return (
                    try JSONSerialization.data(withJSONObject: ["outcome": "disabled"]),
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 200,
                        httpVersion: nil,
                        headerFields: nil
                    )!
                )
            }
        )

        let registered = await client.register(registration, credential: makeWidgetCredential())
        XCTAssertTrue(registered)
        XCTAssertEqual(capturedBody["action"] as? String, "registerPushToken")
        XCTAssertEqual(capturedBody["enabled"] as? Bool, false)
    }

    private func makeWidgetCredential(
        ownerID: UUID = UUID(),
        installationID: UUID = UUID()
    ) -> TaskWidgetCredential {
        TaskWidgetCredential(
            schemaVersion: TaskWidgetCredential.schemaVersion,
            ownerId: ownerID,
            installationId: installationID,
            credential: "twc_\(String(repeating: "A", count: 43))",
            expiresAt: "2099-01-01T00:00:00.000Z"
        )
    }

    private func makeWidgetPushRegistration(
        tokenCharacter: Character
    ) -> TaskWidgetPushRegistration {
        TaskWidgetPushRegistration(
            schemaVersion: TaskWidgetPushRegistration.schemaVersion,
            deviceToken: String(repeating: tokenCharacter, count: 64),
            platform: "ios",
            environment: "development",
            topic: "garden.bath.tasks.push-type.widgets",
            enabled: true
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
