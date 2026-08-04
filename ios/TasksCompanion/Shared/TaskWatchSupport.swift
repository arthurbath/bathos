import Foundation

enum TaskWatchCaptureLaunchPolicy {
    static let captureURL = URL(string: "bathostasks-watch://capture")!

    static func shouldBeginCapture(for url: URL) -> Bool {
        url.scheme?.lowercased() == captureURL.scheme
            && url.host?.lowercased() == captureURL.host
            && (url.path.isEmpty || url.path == "/")
            && url.query == nil
            && url.fragment == nil
    }
}

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

enum TaskWatchConnectivityMessage {
    static let schemaVersion = 1
    static let credentialRequestType = "credentialRequest"
    static let credentialType = "credential"

    static func credentialRequest(identifier: UUID = UUID()) -> [String: Any] {
        [
            "type": credentialRequestType,
            "schemaVersion": schemaVersion,
            "requestId": identifier.uuidString.lowercased(),
        ]
    }

    static func isCredentialRequest(_ payload: [String: Any]) -> Bool {
        payload["type"] as? String == credentialRequestType
            && payload["schemaVersion"] as? Int == schemaVersion
            && (payload["requestId"] as? String).flatMap(UUID.init(uuidString:)) != nil
    }

    static func credentialPayload(_ credential: TaskWatchCredential?) -> [String: Any] {
        var payload: [String: Any] = [
            "type": credentialType,
            "schemaVersion": schemaVersion,
        ]
        if let credential {
            payload["credential"] = try? JSONEncoder().encode(credential)
        } else {
            payload["clear"] = true
        }
        return payload
    }

    static func credential(from payload: [String: Any]) -> TaskWatchCredential? {
        guard payload["schemaVersion"] as? Int == schemaVersion,
              (payload["type"] as? String == credentialType
                || payload["type"] == nil),
              let data = payload["credential"] as? Data,
              let credential = try? JSONDecoder().decode(
                TaskWatchCredential.self,
                from: data
              ),
              (try? credential.validate()) != nil else {
            return nil
        }
        return credential
    }
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

    func createInboxTask(
        summary: String,
        credential: TaskWatchCredential,
        clientMutationId: UUID = UUID(),
        operationId: UUID = UUID()
    ) async throws {
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
                "clientMutationId": clientMutationId.uuidString.lowercased(),
                "operationId": operationId.uuidString.lowercased(),
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
        guard let http = response as? HTTPURLResponse else {
            throw TaskWatchError.rejected
        }
        if http.statusCode == 401 {
            throw TaskWatchError.invalidCredential
        }
        guard http.statusCode == 200, data.count <= maximumBytes else {
            throw TaskWatchError.rejected
        }
        return data
    }
}
