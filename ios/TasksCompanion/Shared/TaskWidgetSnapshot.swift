import AppIntents
import Foundation
import WidgetKit

enum TaskWidgetSnapshotError: Error, Equatable {
    case invalidSchema
    case invalidOwner
    case invalidGeneratedAt
    case invalidPlanningDate
    case invalidLists
    case invalidTask
    case oversizedSnapshot
    case invalidCredential
}

enum TaskWidgetListID: String, Codable, CaseIterable {
    case today
    case upcoming
    case anytime
    case someday
    case done

    static let widgetConfigurationCases: [TaskWidgetListID] = [
        .today,
        .upcoming,
        .anytime,
        .someday,
    ]

    var title: String {
        rawValue.prefix(1).uppercased() + rawValue.dropFirst()
    }

    static func widgetConfigurationValue(_ value: String?) -> TaskWidgetListID {
        guard let value,
              let listID = TaskWidgetListID(rawValue: value.lowercased()),
              widgetConfigurationCases.contains(listID) else {
            return .today
        }
        return listID
    }
}

enum TaskWidgetPresentationPolicy {
    static let largeWidgetTaskLimit = 10
    static var largeWidgetTaskRowMinimumHeight: CGFloat {
#if os(macOS)
        28
#else
        29
#endif
    }
    static let lockScreenTaskLimit = 3
    static let lockScreenTaskRowMinimumHeight: CGFloat = 16
    static let lockScreenTaskRowSpacing: CGFloat = 4
    static let lockScreenTaskFontSize: CGFloat = 13
    static let lockScreenLeadingSystemImageName = "square"
    static let emptyStateSystemImageName = "sparkles"

    static func verticallyCentersLockScreenTasks(taskCount: Int) -> Bool {
        taskCount >= lockScreenTaskLimit
    }

    static func lockScreenURL(for listID: TaskWidgetListID) -> URL {
        TaskNativeRoute.list(listID).deepLinkURL
    }

    static func largeWidgetNewTaskURL(for listID: TaskWidgetListID) -> URL {
        if listID == .today {
            return TaskNativeRoute.newTask.deepLinkURL
        }
        return TaskNativeRoute.newTaskInList(listID).deepLinkURL
    }

    static func upcomingDateLabel(
        upcomingDate: String?,
        planningDate: String,
        locale: Locale = .current
    ) -> String? {
        guard let upcomingDate,
              let upcoming = parseCalendarDate(upcomingDate),
              let planning = parseCalendarDate(planningDate) else {
            return nil
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        guard let dayOffset = calendar.dateComponents(
            [.day],
            from: planning,
            to: upcoming
        ).day, dayOffset > 0 else {
            return nil
        }

        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = locale
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = dayOffset < 7 ? "EEE" : "MMM d"
        return formatter.string(from: upcoming)
    }

    private static func parseCalendarDate(_ value: String) -> Date? {
        guard value.count == 10 else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        return formatter.date(from: value)
    }
}

enum TaskWidgetPlatformPolicy {
    static var supportedFamilies: [WidgetFamily] {
#if os(iOS)
        [.systemLarge, .accessoryRectangular]
#elseif os(macOS)
        [.systemLarge]
#else
        [.systemLarge]
#endif
    }
}

struct TaskWidgetPrimaryLink: Codable, Equatable {
    enum Kind: String, Codable {
        case mail
        case link
    }

    enum IconKind: Equatable {
        case mail
        case jira
        case obsidian
        case link
    }

    let href: String
    let kind: Kind

    var url: URL? {
        guard href.count <= 8_000,
              let url = URL(string: href),
              let scheme = url.scheme?.lowercased(),
              (kind == .mail && scheme == "message")
                || (kind == .link && ["http", "https", "jira", "obsidian"].contains(scheme)) else {
            return nil
        }
        return url
    }

    var iconKind: IconKind {
        guard let url, let scheme = url.scheme?.lowercased() else {
            return .link
        }
        switch scheme {
        case "message":
            return .mail
        case "jira":
            return .jira
        case "obsidian":
            return .obsidian
        case "http", "https":
            return Self.isJiraWebURL(url) ? .jira : .link
        default:
            return .link
        }
    }

    var systemImageName: String {
        switch iconKind {
        case .mail:
            return "envelope"
        case .jira:
            return "bolt"
        case .obsidian:
            return "doc.text"
        case .link:
            return "link"
        }
    }

    var accessibilityLabel: String {
        switch iconKind {
        case .mail:
            return "Open Message"
        case .jira:
            return "Open Jira Link"
        case .obsidian:
            return "Open Obsidian Link"
        case .link:
            return "Open Primary Link"
        }
    }

    private static func isJiraWebURL(_ url: URL) -> Bool {
        guard let hostname = url.host?.lowercased() else {
            return false
        }
        if hostname == "jira.com"
            || hostname.hasPrefix("jira.")
            || hostname.contains(".jira.") {
            return true
        }
        guard hostname == "atlassian.net"
                || hostname.hasSuffix(".atlassian.net") else {
            return false
        }
        let firstPathComponent = url.pathComponents
            .dropFirst()
            .first?
            .lowercased()
        return ["browse", "issues", "jira", "secure"].contains(firstPathComponent)
    }
}

struct TaskWidgetTask: Codable, Equatable, Identifiable {
    let id: UUID
    let summary: String
    let deadline: String?
    let todaySection: String?
    let actionability: String
    let terminalState: String?
    let upcomingDate: String?
    let isRecurrenceProjection: Bool?
    let primaryLink: TaskWidgetPrimaryLink?

    init(
        id: UUID,
        summary: String,
        deadline: String?,
        todaySection: String?,
        actionability: String,
        terminalState: String?,
        upcomingDate: String? = nil,
        isRecurrenceProjection: Bool? = nil,
        primaryLink: TaskWidgetPrimaryLink? = nil
    ) {
        self.id = id
        self.summary = summary
        self.deadline = deadline
        self.todaySection = todaySection
        self.actionability = actionability
        self.terminalState = terminalState
        self.upcomingDate = upcomingDate
        self.isRecurrenceProjection = isRecurrenceProjection
        self.primaryLink = primaryLink
    }
}

struct TaskWidgetList: Codable, Equatable, Identifiable {
    let id: TaskWidgetListID
    let title: String
    let totalCount: Int
    let truncated: Bool
    let tasks: [TaskWidgetTask]
}

struct TaskWidgetSnapshot: Codable, Equatable {
    static let schemaVersion = 2
    static let maximumEncodedBytes = 512 * 1_024
    static let maximumTasksPerList = 50
    static let maximumSummaryCharacters = 500

    let type: String
    let schemaVersion: Int
    let ownerId: UUID
    var generatedAt: String
    let planningDate: String
    var lists: [TaskWidgetList]

    static func decodeAndValidate(_ data: Data) throws -> TaskWidgetSnapshot {
        guard data.count <= maximumEncodedBytes else {
            throw TaskWidgetSnapshotError.oversizedSnapshot
        }
        let snapshot = try JSONDecoder().decode(TaskWidgetSnapshot.self, from: data)
        try snapshot.validate()
        return snapshot
    }

    func validate() throws {
        guard type == "snapshot", schemaVersion == Self.schemaVersion else {
            throw TaskWidgetSnapshotError.invalidSchema
        }
        guard Self.parseGeneratedAt(generatedAt) != nil else {
            throw TaskWidgetSnapshotError.invalidGeneratedAt
        }
        guard Self.isCalendarDate(planningDate) else {
            throw TaskWidgetSnapshotError.invalidPlanningDate
        }
        guard lists.count == TaskWidgetListID.allCases.count,
              Set(lists.map(\.id)) == Set(TaskWidgetListID.allCases) else {
            throw TaskWidgetSnapshotError.invalidLists
        }

        for list in lists {
            guard list.title == list.id.title,
                  list.totalCount >= list.tasks.count,
                  list.tasks.count <= Self.maximumTasksPerList,
                  list.truncated == (list.totalCount > list.tasks.count) else {
                throw TaskWidgetSnapshotError.invalidLists
            }
            for task in list.tasks {
                guard !task.summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                      task.summary.count <= Self.maximumSummaryCharacters,
                      task.deadline.map(Self.isCalendarDate) ?? true,
                      task.upcomingDate.map(Self.isCalendarDate) ?? true,
                      Self.allowedTodaySections.contains(task.todaySection),
                      Self.allowedActionability.contains(task.actionability),
                      Self.allowedTerminalStates.contains(task.terminalState),
                      task.primaryLink?.url != nil || task.primaryLink == nil,
                      task.isRecurrenceProjection != true
                        || (
                          list.id == .upcoming
                          && task.upcomingDate != nil
                          && task.terminalState == nil
                        ),
                      list.id == .upcoming || task.upcomingDate == nil,
                      list.id == .upcoming
                        || task.isRecurrenceProjection != true else {
                    throw TaskWidgetSnapshotError.invalidTask
                }
            }
        }
    }

    func contentSignature() throws -> Data {
        var normalized = self
        normalized.generatedAt = ""
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(normalized)
    }

    func list(_ id: TaskWidgetListID) -> TaskWidgetList? {
        lists.first { $0.id == id }
    }

    mutating func completeTask(_ taskID: UUID, completedAt: String) -> Bool {
        var sourceTask: TaskWidgetTask?
        var changed = false
        lists = lists.map { list in
            guard list.id != .done else { return list }
            let remaining = list.tasks.filter { task in
                if task.id == taskID {
                    sourceTask = sourceTask ?? task
                    changed = true
                    return false
                }
                return true
            }
            guard remaining.count != list.tasks.count else { return list }
            return TaskWidgetList(
                id: list.id,
                title: list.title,
                totalCount: max(0, list.totalCount - 1),
                truncated: max(0, list.totalCount - 1) > remaining.count,
                tasks: remaining
            )
        }
        guard let sourceTask else { return false }
        lists = lists.map { list in
            guard list.id == .done else { return list }
            let completed = TaskWidgetTask(
                id: sourceTask.id,
                summary: sourceTask.summary,
                deadline: sourceTask.deadline,
                todaySection: sourceTask.todaySection,
                actionability: sourceTask.actionability,
                terminalState: "completed",
                upcomingDate: nil,
                isRecurrenceProjection: false,
                primaryLink: sourceTask.primaryLink
            )
            let withoutDuplicate = list.tasks.filter { $0.id != taskID }
            let tasks = Array(([completed] + withoutDuplicate).prefix(Self.maximumTasksPerList))
            let totalCount = list.totalCount + (list.tasks.contains { $0.id == taskID } ? 0 : 1)
            return TaskWidgetList(
                id: list.id,
                title: list.title,
                totalCount: totalCount,
                truncated: totalCount > tasks.count,
                tasks: tasks
            )
        }
        generatedAt = completedAt
        return changed
    }

    var generatedDate: Date? {
        Self.parseGeneratedAt(generatedAt)
    }

    private static func parseGeneratedAt(_ value: String) -> Date? {
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
        ]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }
        return ISO8601DateFormatter().date(from: value)
    }

    private static func isCalendarDate(_ value: String) -> Bool {
        guard value.count == 10,
              value[value.index(value.startIndex, offsetBy: 4)] == "-",
              value[value.index(value.startIndex, offsetBy: 7)] == "-" else {
            return false
        }
        let digits = value.enumerated().filter { $0.offset != 4 && $0.offset != 7 }
        return digits.allSatisfy(\.element.isNumber)
    }
    private static let allowedTodaySections: Set<String?> = [
        nil,
        "inbox",
        "now",
        "next",
        "later",
    ]
    private static let allowedActionability: Set<String> = [
        "actionable",
        "rechecking",
        "waiting",
    ]
    private static let allowedTerminalStates: Set<String?> = [
        nil,
        "completed",
        "canceled",
        "deleted",
    ]
}

struct TaskWidgetStore {
    static let fileName = "task-widget-snapshot-v1.json"

    let fileURL: URL

    init?(appGroupIdentifier: String = TaskCompanionConstants.appGroupIdentifier) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else {
            return nil
        }
        self.init(directoryURL: containerURL)
    }

    init(directoryURL: URL) {
        fileURL = directoryURL.appendingPathComponent(Self.fileName, isDirectory: false)
    }

    func accept(_ data: Data) throws -> Bool {
        let snapshot = try TaskWidgetSnapshot.decodeAndValidate(data)
        return try store(snapshot)
    }

    func store(_ snapshot: TaskWidgetSnapshot) throws -> Bool {
        try snapshot.validate()
        if let current = try? load(),
           try current.contentSignature() == snapshot.contentSignature() {
            return false
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(snapshot)
        guard data.count <= TaskWidgetSnapshot.maximumEncodedBytes else {
            throw TaskWidgetSnapshotError.oversizedSnapshot
        }
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: fileURL, options: .atomic)
#if os(iOS)
        try FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: fileURL.path
        )
#endif
        return true
    }

    func load() throws -> TaskWidgetSnapshot? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return nil
        }
        return try TaskWidgetSnapshot.decodeAndValidate(Data(contentsOf: fileURL))
    }

    @discardableResult
    func clear() throws -> Bool {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return false
        }
        try FileManager.default.removeItem(at: fileURL)
        return true
    }
}

struct TaskWidgetCredential: Codable, Equatable {
    static let schemaVersion = 1

    let schemaVersion: Int
    let ownerId: UUID
    let installationId: UUID
    let credential: String
    let expiresAt: String

    func validate(now: Date = Date()) throws {
        guard schemaVersion == Self.schemaVersion,
              credential.range(
                of: #"^twc_[A-Za-z0-9_-]{43}$"#,
                options: .regularExpression
              ) != nil,
              let expiry = TaskWidgetCredential.parseExpiry(expiresAt),
              expiry > now else {
            throw TaskWidgetSnapshotError.invalidCredential
        }
    }

    private static func parseExpiry(_ value: String) -> Date? {
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
        ]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }
        return ISO8601DateFormatter().date(from: value)
    }
}

struct TaskWidgetCompletionResult: Equatable {
    let outcome: String
    let completedAt: String?
}

struct TaskWidgetActionDiagnosticStore {
    static let fileName = "task-widget-action-status.txt"

    let fileURL: URL

    init?(appGroupIdentifier: String = TaskCompanionConstants.appGroupIdentifier) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else {
            return nil
        }
        fileURL = containerURL
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent(Self.fileName, isDirectory: false)
    }

    func record(_ status: String) {
        guard status.range(
            of: #"^[a-z][a-z0-9-]{0,63}$"#,
            options: .regularExpression
        ) != nil else {
            return
        }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try Data(status.utf8).write(to: fileURL, options: .atomic)
#if os(iOS)
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: fileURL.path
            )
#endif
        } catch {
            return
        }
    }
}

struct CompleteTaskIntent: SetValueIntent {
    static let title: LocalizedStringResource = "Complete Task"
    static let openAppWhenRun = false

    @Parameter(title: "Task")
    var taskID: String

    @Parameter(title: "Completed")
    var value: Bool

    init() {
        taskID = ""
        value = false
    }

    init(taskID: String) {
        self.taskID = taskID
        value = false
    }

    func perform() async throws -> some IntentResult {
        let diagnosticStore = TaskWidgetActionDiagnosticStore()
        diagnosticStore?.record(value ? "started-on" : "started-off")
        do {
            // This intent is exposed only on open tasks and is deliberately
            // one-way. Some physical-device WidgetKit versions deliver the
            // Toggle's pre-tap value here, so either Boolean means "complete".
            guard let taskUUID = UUID(uuidString: taskID) else {
                diagnosticStore?.record("invalid-task")
                return .result()
            }
            guard let credentialStore = TaskWidgetCredentialStore() else {
                diagnosticStore?.record("credential-store-unavailable")
                return .result()
            }
            guard let credential = try credentialStore.load() else {
                diagnosticStore?.record("credential-missing")
                return .result()
            }
            guard let snapshotStore = TaskWidgetStore() else {
                diagnosticStore?.record("snapshot-store-unavailable")
                return .result()
            }

            diagnosticStore?.record("requesting")
            guard let completion = await TaskWidgetCompletionClient().complete(
                taskID: taskUUID,
                credential: credential
            ) else {
                diagnosticStore?.record("request-failed")
                return .result()
            }

            diagnosticStore?.record("request-accepted")
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            if var snapshot = try snapshotStore.load() {
                let completedAt = completion.completedAt
                    ?? ISO8601DateFormatter().string(from: Date())
                if snapshot.completeTask(taskUUID, completedAt: completedAt) {
                    _ = try snapshotStore.store(snapshot)
                }
            }
            WidgetCenter.shared.reloadTimelines(ofKind: TaskCompanionConstants.widgetKind)
            diagnosticStore?.record("reconciled")
            return .result()
        } catch {
            TaskWidgetActionDiagnosticStore()?.record("local-store-failed")
            return .result()
        }
    }
}

struct TaskWidgetCompletionClient {
    typealias Transport = (URLRequest) async throws -> (Data, URLResponse)

    let endpoint: URL
    let transport: Transport

    init(
        endpoint: URL = TaskCompanionConstants.widgetActionsURL,
        transport: @escaping Transport = { request in
            try await URLSession.shared.data(for: request)
        }
    ) {
        self.endpoint = endpoint
        self.transport = transport
    }

    func complete(
        taskID: UUID,
        credential: TaskWidgetCredential,
        clientMutationID: UUID = UUID(),
        operationID: UUID = UUID()
    ) async -> TaskWidgetCompletionResult? {
        do {
            try credential.validate()
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.timeoutInterval = 5
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(
                "Widget \(credential.credential)",
                forHTTPHeaderField: "Authorization"
            )
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "action": "complete",
                "taskId": taskID.uuidString.lowercased(),
                "clientMutationId": clientMutationID.uuidString.lowercased(),
                "operationId": operationID.uuidString.lowercased(),
            ])

            for attempt in 0..<2 {
                do {
                    let (data, response) = try await transport(request)
                    guard let httpResponse = response as? HTTPURLResponse else {
                        return nil
                    }
                    if httpResponse.statusCode != 200 {
                        if attempt == 0, Self.isRetryable(httpResponse.statusCode) {
                            try? await Task.sleep(nanoseconds: 250_000_000)
                            continue
                        }
                        return nil
                    }
                    guard data.count <= 2_048,
                          let body = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                          let outcome = body["outcome"] as? String,
                          ["accepted", "already_applied", "noop"].contains(outcome) else {
                        return nil
                    }
                    return TaskWidgetCompletionResult(
                        outcome: outcome,
                        completedAt: body["completed_at"] as? String
                    )
                } catch {
                    if attempt == 0 {
                        try? await Task.sleep(nanoseconds: 250_000_000)
                        continue
                    }
                    return nil
                }
            }
            return nil
        } catch {
            return nil
        }
    }

    private static func isRetryable(_ statusCode: Int) -> Bool {
        [408, 425, 429].contains(statusCode) || (500...599).contains(statusCode)
    }
}

struct TaskWidgetSnapshotClient {
    typealias Transport = (URLRequest) async throws -> (Data, URLResponse)

    let endpoint: URL
    let transport: Transport

    init(
        endpoint: URL = TaskCompanionConstants.widgetActionsURL,
        transport: @escaping Transport = { request in
            try await URLSession.shared.data(for: request)
        }
    ) {
        self.endpoint = endpoint
        self.transport = transport
    }

    func fetch(credential: TaskWidgetCredential) async -> TaskWidgetSnapshot? {
        do {
            try credential.validate()
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.timeoutInterval = 8
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(
                "Widget \(credential.credential)",
                forHTTPHeaderField: "Authorization"
            )
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "action": "snapshot",
            ])

            for attempt in 0..<2 {
                let data: Data
                let response: URLResponse
                do {
                    (data, response) = try await transport(request)
                } catch {
                    if attempt == 0 {
                        try? await Task.sleep(nanoseconds: 250_000_000)
                        continue
                    }
                    return nil
                }
                guard let httpResponse = response as? HTTPURLResponse else {
                    return nil
                }
                if httpResponse.statusCode != 200 {
                    if attempt == 0, Self.isRetryable(httpResponse.statusCode) {
                        try? await Task.sleep(nanoseconds: 250_000_000)
                        continue
                    }
                    return nil
                }
                guard let snapshot = try? TaskWidgetSnapshot.decodeAndValidate(data),
                      snapshot.ownerId == credential.ownerId else {
                    return nil
                }
                return snapshot
            }
            return nil
        } catch {
            return nil
        }
    }

    private static func isRetryable(_ statusCode: Int) -> Bool {
        [408, 425, 429].contains(statusCode) || (500...599).contains(statusCode)
    }
}

struct TaskWidgetBackgroundRefresher {
    let credentialStore: TaskWidgetCredentialStore
    let snapshotStore: TaskWidgetStore
    let client: TaskWidgetSnapshotClient

    func refresh(now: Date = Date()) async -> TaskWidgetSnapshot? {
        let cachedSnapshot = try? snapshotStore.load()
        guard let credential = try? credentialStore.load(now: now),
              let refreshedSnapshot = await client.fetch(credential: credential) else {
            return cachedSnapshot
        }
        do {
            _ = try snapshotStore.store(refreshedSnapshot)
            return refreshedSnapshot
        } catch {
            return cachedSnapshot
        }
    }
}

struct TaskWidgetCredentialStore {
    static let fileName = "task-widget-credential-v1.json"

    let fileURL: URL

    init?(appGroupIdentifier: String = TaskCompanionConstants.appGroupIdentifier) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else {
            return nil
        }
        self.init(directoryURL: containerURL)
    }

    init(directoryURL: URL) {
        fileURL = directoryURL.appendingPathComponent(Self.fileName, isDirectory: false)
    }

    func store(_ credential: TaskWidgetCredential) throws {
        try credential.validate()
        let data = try JSONEncoder().encode(credential)
        guard data.count <= 2_048 else {
            throw TaskWidgetSnapshotError.invalidCredential
        }
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: fileURL, options: .atomic)
#if os(iOS)
        try FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: fileURL.path
        )
#endif
    }

    func load(now: Date = Date()) throws -> TaskWidgetCredential? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        let data = try Data(contentsOf: fileURL)
        guard data.count <= 2_048 else {
            throw TaskWidgetSnapshotError.invalidCredential
        }
        let credential = try JSONDecoder().decode(TaskWidgetCredential.self, from: data)
        try credential.validate(now: now)
        return credential
    }

    @discardableResult
    func clear() throws -> Bool {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return false }
        try FileManager.default.removeItem(at: fileURL)
        return true
    }
}

struct TaskWidgetInstallationStore {
    static let fileName = "task-widget-installation-id-v1.txt"

    let fileURL: URL

    init?(appGroupIdentifier: String = TaskCompanionConstants.appGroupIdentifier) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else {
            return nil
        }
        self.init(directoryURL: containerURL)
    }

    init(directoryURL: URL) {
        fileURL = directoryURL.appendingPathComponent(Self.fileName, isDirectory: false)
    }

    func identifier() throws -> UUID {
        if let value = try? String(contentsOf: fileURL, encoding: .utf8),
           let existing = UUID(uuidString: value.trimmingCharacters(in: .whitespacesAndNewlines)) {
            return existing
        }
        let identifier = UUID()
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try identifier.uuidString.lowercased().write(
            to: fileURL,
            atomically: true,
            encoding: .utf8
        )
#if os(iOS)
        try FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: fileURL.path
        )
#endif
        return identifier
    }
}
