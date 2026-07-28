import Foundation

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

    var title: String {
        rawValue.prefix(1).uppercased() + rawValue.dropFirst()
    }
}

struct TaskWidgetPrimaryLink: Codable, Equatable {
    enum Kind: String, Codable {
        case mail
        case link
    }

    let href: String
    let kind: Kind

    var url: URL? {
        guard href.count <= 8_000,
              let url = URL(string: href),
              let scheme = url.scheme?.lowercased(),
              (kind == .mail && scheme == "message")
                || (kind == .link && ["http", "https"].contains(scheme)) else {
            return nil
        }
        return url
    }
}

struct TaskWidgetTask: Codable, Equatable, Identifiable {
    let id: UUID
    let summary: String
    let deadline: String?
    let todaySection: String?
    let actionability: String
    let terminalState: String?
    let primaryLink: TaskWidgetPrimaryLink?

    init(
        id: UUID,
        summary: String,
        deadline: String?,
        todaySection: String?,
        actionability: String,
        terminalState: String?,
        primaryLink: TaskWidgetPrimaryLink? = nil
    ) {
        self.id = id
        self.summary = summary
        self.deadline = deadline
        self.todaySection = todaySection
        self.actionability = actionability
        self.terminalState = terminalState
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
                      Self.allowedTodaySections.contains(task.todaySection),
                      Self.allowedActionability.contains(task.actionability),
                      Self.allowedTerminalStates.contains(task.terminalState),
                      task.primaryLink?.url != nil || task.primaryLink == nil else {
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
        if let current = try load(),
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

            let (data, response) = try await transport(request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200,
                  data.count <= 2_048,
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
            return nil
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
