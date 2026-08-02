import Foundation

struct TaskWatchCredential: Codable, Equatable {
    static let schemaVersion = 1

    let schemaVersion: Int
    let ownerId: UUID
    let credential: String
    let expiresAt: String

    func validate(now: Date = Date()) throws {
        guard schemaVersion == Self.schemaVersion,
              credential.range(
                of: #"^twc_[A-Za-z0-9_-]{43}$"#,
                options: .regularExpression
              ) != nil,
              let expiry = Self.parseDate(expiresAt),
              expiry > now else {
            throw TaskWatchError.invalidCredential
        }
    }

    private static func parseDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

struct TaskWatchTodayProgress: Codable, Equatable {
    static let schemaVersion = 1

    let type: String
    let schemaVersion: Int
    let ownerId: UUID
    let generatedAt: String
    let planningDate: String
    let completedCount: Int
    let totalCount: Int

    var fraction: Double {
        guard totalCount > 0 else { return 0 }
        return min(1, max(0, Double(completedCount) / Double(totalCount)))
    }

    func validate(ownerId expectedOwner: UUID? = nil) throws {
        guard type == "todayProgress",
              schemaVersion == Self.schemaVersion,
              expectedOwner == nil || ownerId == expectedOwner,
              planningDate.range(
                of: #"^\d{4}-\d{2}-\d{2}$"#,
                options: .regularExpression
              ) != nil,
              completedCount >= 0,
              totalCount >= completedCount else {
            throw TaskWatchError.invalidProgress
        }
    }
}

enum TaskWatchError: Error {
    case appGroupUnavailable
    case invalidCredential
    case invalidProgress
    case rejected
}

struct TaskWatchCredentialStore {
    static let fileName = "task-watch-credential-v1.json"
    let fileURL: URL

    init?(appGroupIdentifier: String = TaskCompanionConstants.appGroupIdentifier) {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else { return nil }
        fileURL = container.appendingPathComponent(Self.fileName)
    }

    func store(_ value: TaskWatchCredential) throws {
        try value.validate()
        let data = try JSONEncoder().encode(value)
        guard data.count <= 2_048 else { throw TaskWatchError.invalidCredential }
        try data.write(to: fileURL, options: .atomic)
    }

    func load(now: Date = Date()) throws -> TaskWatchCredential? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        let data = try Data(contentsOf: fileURL)
        guard data.count <= 2_048 else { throw TaskWatchError.invalidCredential }
        let value = try JSONDecoder().decode(TaskWatchCredential.self, from: data)
        try value.validate(now: now)
        return value
    }

    func clear() throws {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        try FileManager.default.removeItem(at: fileURL)
    }
}

struct TaskWatchProgressStore {
    static let fileName = "task-watch-progress-v1.json"
    let fileURL: URL

    init?(appGroupIdentifier: String = TaskCompanionConstants.appGroupIdentifier) {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else { return nil }
        fileURL = container.appendingPathComponent(Self.fileName)
    }

    func store(_ value: TaskWatchTodayProgress) throws {
        try value.validate()
        try JSONEncoder().encode(value).write(to: fileURL, options: .atomic)
    }

    func load() throws -> TaskWatchTodayProgress? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        let value = try JSONDecoder().decode(
            TaskWatchTodayProgress.self,
            from: Data(contentsOf: fileURL)
        )
        try value.validate()
        return value
    }

    func clear() throws {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        try FileManager.default.removeItem(at: fileURL)
    }
}

struct TaskWatchActionsClient {
    typealias Transport = (URLRequest) async throws -> (Data, URLResponse)
    let endpoint: URL
    let transport: Transport

    init(
        endpoint: URL = TaskCompanionConstants.widgetActionsURL,
        transport: @escaping Transport = { try await URLSession.shared.data(for: $0) }
    ) {
        self.endpoint = endpoint
        self.transport = transport
    }

    func createInboxTask(summary: String, credential: TaskWatchCredential) async throws {
        try credential.validate()
        let normalized = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, normalized.count <= 500 else {
            throw TaskWatchError.rejected
        }
        _ = try await request(
            action: "createInboxTask",
            credential: credential,
            body: [
                "summary": normalized,
                "clientMutationId": UUID().uuidString.lowercased(),
                "operationId": UUID().uuidString.lowercased(),
            ],
            maximumBytes: 2_048
        )
    }

    func fetchProgress(credential: TaskWatchCredential) async throws -> TaskWatchTodayProgress {
        try credential.validate()
        let data = try await request(
            action: "todayProgress",
            credential: credential,
            body: [:],
            maximumBytes: 4_096
        )
        let progress = try JSONDecoder().decode(TaskWatchTodayProgress.self, from: data)
        try progress.validate(ownerId: credential.ownerId)
        return progress
    }

    private func request(
        action: String,
        credential: TaskWatchCredential,
        body: [String: Any],
        maximumBytes: Int
    ) async throws -> Data {
        var payload = body
        payload["action"] = action
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(
            "Widget \(credential.credential)",
            forHTTPHeaderField: "Authorization"
        )
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await transport(request)
        guard let http = response as? HTTPURLResponse,
              http.statusCode == 200,
              data.count <= maximumBytes else {
            throw TaskWatchError.rejected
        }
        return data
    }
}
