import Foundation
import Security

struct TasksNativeQuickEntryCredential: Codable, Equatable {
    static let tokenPattern = /^tqe_[A-Za-z0-9_-]{43}$/

    let payloadSchemaVersion: Int
    let contractFingerprint: String
    let capability: String
    let ownerId: UUID
    let installationId: UUID
    let credential: String
    let expiresAt: String

    func validate(now: Date = Date()) throws {
        guard
            payloadSchemaVersion == TasksNativeQuickEntryContract.payloadSchemaVersion,
            contractFingerprint == TasksNativeQuickEntryContract.sourceFingerprint,
            capability == TasksNativeQuickEntryContract.capability,
            credential.wholeMatch(of: Self.tokenPattern) != nil,
            let expiration = TasksNativeQuickEntryDateParser.date(from: expiresAt),
            expiration > now
        else {
            throw TasksNativeQuickEntryServiceFailure.invalidCredential
        }
    }
}

struct TasksNativeQuickEntryBootstrap: Codable, Equatable {
    let outcome: String
    let type: String
    let schemaVersion: Int
    let payloadSchemaVersion: Int
    let contractFingerprint: String
    let capability: String
    let ownerId: UUID
    let generatedAt: String
    let planningDate: String
    let planningTimeZone: String
    let areas: [TasksNativeQuickEntryArea]
    let limits: Limits

    struct Limits: Codable, Equatable {
        let maximumChecklistItems: Int
        let maximumPayloadBytes: Int
    }

    func validate(for credential: TasksNativeQuickEntryCredential) throws {
        guard
            outcome == "accepted",
            type == "nativeQuickEntryBootstrap",
            schemaVersion == TasksNativeQuickEntryContract.schemaVersion,
            payloadSchemaVersion == TasksNativeQuickEntryContract.payloadSchemaVersion,
            contractFingerprint == TasksNativeQuickEntryContract.sourceFingerprint,
            capability == TasksNativeQuickEntryContract.capability,
            ownerId == credential.ownerId,
            TasksNativeQuickEntryDateParser.date(from: generatedAt) != nil,
            TasksNativeQuickEntryDateParser.calendarDate(from: planningDate) != nil,
            !planningTimeZone.isEmpty,
            planningTimeZone.count <= 255,
            areas.count <= 10_000,
            Set(areas.map(\.id)).count == areas.count,
            areas.allSatisfy({ !$0.name.isEmpty && $0.name.count <= 500 }),
            limits.maximumChecklistItems
                == TasksNativeQuickEntryContract.maximumChecklistItems,
            limits.maximumPayloadBytes
                == TasksNativeQuickEntryContract.maximumPayloadBytes
        else {
            throw TasksNativeQuickEntryServiceFailure.incompatibleContract
        }
    }
}

struct TasksNativeQuickEntryReceipt: Codable, Equatable {
    let outcome: String
    let taskId: UUID
    let revision: Int
    let acceptedAt: String
    let planningDate: String?

    func validate() throws {
        guard
            ["accepted", "already_applied"].contains(outcome),
            revision > 0,
            TasksNativeQuickEntryDateParser.date(from: acceptedAt) != nil,
            planningDate == nil
                || TasksNativeQuickEntryDateParser.calendarDate(from: planningDate!) != nil
        else {
            throw TasksNativeQuickEntryServiceFailure.invalidResponse
        }
    }
}

enum TasksNativeQuickEntryServiceFailure: LocalizedError, Equatable {
    case unavailable
    case invalidCredential
    case incompatibleContract
    case invalidResponse
    case rejected(code: String?)

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Quick Entry is not ready yet. Open Tasks and try again."
        case .invalidCredential:
            return "Quick Entry authorization expired. Open Tasks and try again."
        case .incompatibleContract:
            return "Quick Entry needs a newer Tasks session. Open Tasks and try again."
        case .invalidResponse:
            return "Tasks returned an invalid Quick Entry response."
        case let .rejected(code):
            return code == "invalid_credential"
                ? "Quick Entry authorization expired. Open Tasks and try again."
                : "The task could not be saved. Review its fields and try again."
        }
    }
}

struct TasksNativeQuickEntryCredentialStore {
    static let service = "garden.bath.tasks.native-quick-entry"
    static let account = "native-quick-entry-v1"

    func store(_ credential: TasksNativeQuickEntryCredential) throws {
        try credential.validate()
        let data = try JSONEncoder().encode(credential)
        let query = baseQuery
        let attributes: [CFString: Any] = [
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let updateStatus = SecItemUpdate(
            query as CFDictionary,
            attributes as CFDictionary
        )
        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw TasksNativeQuickEntryServiceFailure.unavailable
        }
        var addition = query
        addition.merge(attributes) { _, replacement in replacement }
        let addStatus = SecItemAdd(addition as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw TasksNativeQuickEntryServiceFailure.unavailable
        }
    }

    func load(now: Date = Date()) throws -> TasksNativeQuickEntryCredential? {
        var query = baseQuery
        query[kSecReturnData] = true
        query[kSecMatchLimit] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess, let data = result as? Data else {
            throw TasksNativeQuickEntryServiceFailure.unavailable
        }
        let credential = try JSONDecoder().decode(
            TasksNativeQuickEntryCredential.self,
            from: data
        )
        try credential.validate(now: now)
        return credential
    }

    @discardableResult
    func clear() throws -> Bool {
        let status = SecItemDelete(baseQuery as CFDictionary)
        if status == errSecItemNotFound {
            return false
        }
        guard status == errSecSuccess else {
            throw TasksNativeQuickEntryServiceFailure.unavailable
        }
        return true
    }

    private var baseQuery: [CFString: Any] {
        [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: Self.service,
            kSecAttrAccount: Self.account,
            kSecUseDataProtectionKeychain: true,
        ]
    }
}

struct TasksNativeQuickEntryBootstrapStore {
    static let maximumEncodedBytes = 512 * 1_024

    let fileURL: URL

    init(fileURL: URL? = nil) {
        if let fileURL {
            self.fileURL = fileURL
            return
        }
        let applicationSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? FileManager.default.temporaryDirectory
        self.fileURL = applicationSupport
            .appendingPathComponent("garden.bath.tasks", isDirectory: true)
            .appendingPathComponent("NativeQuickEntry", isDirectory: true)
            .appendingPathComponent("bootstrap-v1.json", isDirectory: false)
    }

    func store(
        _ bootstrap: TasksNativeQuickEntryBootstrap,
        credential: TasksNativeQuickEntryCredential
    ) throws {
        try bootstrap.validate(for: credential)
        let data = try JSONEncoder().encode(bootstrap)
        guard data.count <= Self.maximumEncodedBytes else {
            throw TasksNativeQuickEntryServiceFailure.invalidResponse
        }
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        try data.write(to: fileURL, options: .atomic)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: fileURL.path
        )
    }

    func load(
        credential: TasksNativeQuickEntryCredential
    ) throws -> TasksNativeQuickEntryBootstrap? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return nil
        }
        let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
        guard data.count <= Self.maximumEncodedBytes else {
            throw TasksNativeQuickEntryServiceFailure.invalidResponse
        }
        let bootstrap = try JSONDecoder().decode(
            TasksNativeQuickEntryBootstrap.self,
            from: data
        )
        try bootstrap.validate(for: credential)
        return bootstrap
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

final class TasksNativeQuickEntryService {
    typealias Transport = (URLRequest) async throws -> (Data, URLResponse)
    typealias CredentialLoader = () throws -> TasksNativeQuickEntryCredential?
    typealias BootstrapLoader = (
        TasksNativeQuickEntryCredential
    ) throws -> TasksNativeQuickEntryBootstrap?
    typealias BootstrapWriter = (
        TasksNativeQuickEntryBootstrap,
        TasksNativeQuickEntryCredential
    ) throws -> Void
    typealias RetryDelay = () async -> Void

    private let endpoint: URL
    private let credentialLoader: CredentialLoader
    private let bootstrapLoader: BootstrapLoader
    private let bootstrapWriter: BootstrapWriter
    private let transport: Transport
    private let retryDelay: RetryDelay

    init(
        endpoint: URL = TaskCompanionConstants.widgetActionsURL,
        credentialStore: TasksNativeQuickEntryCredentialStore = .init(),
        bootstrapStore: TasksNativeQuickEntryBootstrapStore = .init(),
        transport: @escaping Transport = { request in
            try await URLSession.shared.data(for: request)
        }
    ) {
        self.endpoint = endpoint
        self.credentialLoader = { try credentialStore.load() }
        self.bootstrapLoader = { credential in
            try bootstrapStore.load(credential: credential)
        }
        self.bootstrapWriter = { bootstrap, credential in
            try bootstrapStore.store(bootstrap, credential: credential)
        }
        self.transport = transport
        self.retryDelay = {
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
    }

    init(
        endpoint: URL,
        credentialLoader: @escaping CredentialLoader,
        bootstrapLoader: @escaping BootstrapLoader = { _ in nil },
        bootstrapWriter: @escaping BootstrapWriter = { _, _ in },
        retryDelay: @escaping RetryDelay = {},
        transport: @escaping Transport
    ) {
        self.endpoint = endpoint
        self.credentialLoader = credentialLoader
        self.bootstrapLoader = bootstrapLoader
        self.bootstrapWriter = bootstrapWriter
        self.retryDelay = retryDelay
        self.transport = transport
    }

    func cachedBootstrap() -> TasksNativeQuickEntryBootstrap? {
        guard
            let credential = try? credentialLoader(),
            let bootstrap = try? bootstrapLoader(credential)
        else {
            return nil
        }
        return bootstrap
    }

    func refreshBootstrap() async throws -> TasksNativeQuickEntryBootstrap {
        let credential = try requiredCredential()
        let data = try await request(
            action: "quickEntryBootstrap",
            credential: credential,
            payload: nil
        )
        let bootstrap = try JSONDecoder().decode(
            TasksNativeQuickEntryBootstrap.self,
            from: data
        )
        try bootstrap.validate(for: credential)
        try bootstrapWriter(bootstrap, credential)
        return bootstrap
    }

    func create(_ submission: TasksNativeQuickEntrySubmission) async throws -> UUID {
        let credential = try requiredCredential()
        let submissionData = try JSONEncoder().encode(submission)
        guard
            submissionData.count <= TasksNativeQuickEntryContract.maximumPayloadBytes,
            let payload = try JSONSerialization.jsonObject(with: submissionData)
                as? [String: Any]
        else {
            throw TasksNativeQuickEntryServiceFailure.invalidResponse
        }
        let data = try await request(
            action: "createQuickEntry",
            credential: credential,
            payload: payload
        )
        let receipt = try JSONDecoder().decode(
            TasksNativeQuickEntryReceipt.self,
            from: data
        )
        try receipt.validate()
        return receipt.taskId
    }

    private func requiredCredential() throws -> TasksNativeQuickEntryCredential {
        guard let credential = try credentialLoader() else {
            throw TasksNativeQuickEntryServiceFailure.unavailable
        }
        return credential
    }

    private func request(
        action: String,
        credential: TasksNativeQuickEntryCredential,
        payload: [String: Any]?
    ) async throws -> Data {
        var body: [String: Any] = ["action": action]
        if let payload {
            body["payload"] = payload
        }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(
            "QuickEntry \(credential.credential)",
            forHTTPHeaderField: "Authorization"
        )
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        for attempt in 0..<2 {
            do {
                let (data, response) = try await transport(request)
                guard let response = response as? HTTPURLResponse else {
                    throw TasksNativeQuickEntryServiceFailure.invalidResponse
                }
                if response.statusCode == 200 {
                    guard data.count <= TasksNativeQuickEntryBootstrapStore.maximumEncodedBytes else {
                        throw TasksNativeQuickEntryServiceFailure.invalidResponse
                    }
                    return data
                }
                if response.statusCode == 401 {
                    throw TasksNativeQuickEntryServiceFailure.invalidCredential
                }
                if attempt == 0, Self.isRetryable(response.statusCode) {
                    await retryDelay()
                    continue
                }
                let code = (try? JSONSerialization.jsonObject(with: data))
                    .flatMap { $0 as? [String: Any] }?["code"] as? String
                throw TasksNativeQuickEntryServiceFailure.rejected(code: code)
            } catch let failure as TasksNativeQuickEntryServiceFailure {
                throw failure
            } catch {
                if attempt == 0 {
                    await retryDelay()
                    continue
                }
                throw TasksNativeQuickEntryServiceFailure.unavailable
            }
        }
        throw TasksNativeQuickEntryServiceFailure.unavailable
    }

    private static func isRetryable(_ statusCode: Int) -> Bool {
        [408, 425, 429].contains(statusCode) || (500...599).contains(statusCode)
    }
}

enum TasksNativeQuickEntryDateParser {
    static func date(from value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    static func calendarDate(from value: String) -> TasksNativeCalendarDate? {
        let pieces = value.split(separator: "-")
        guard
            pieces.count == 3,
            let year = Int(pieces[0]),
            let month = Int(pieces[1]),
            let day = Int(pieces[2])
        else {
            return nil
        }
        return try? TasksNativeCalendarDate(year: year, month: month, day: day)
    }
}
