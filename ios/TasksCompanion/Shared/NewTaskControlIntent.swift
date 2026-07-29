import AppIntents
import Foundation

@available(iOS 18.0, *)
enum NewTaskControlTarget: String, AppEnum {
    case todayInbox

    static var typeDisplayRepresentation = TypeDisplayRepresentation("New Task Destination")
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .todayInbox: DisplayRepresentation("Today Inbox"),
    ]
}

@available(iOS 18.0, *)
struct OpenNewTaskIntent: OpenIntent {
    static var title: LocalizedStringResource = "New Task"

    @Parameter(title: "Destination")
    var target: NewTaskControlTarget

    init() {
        target = .todayInbox
    }

    init(target: NewTaskControlTarget) {
        self.target = target
    }

    func perform() async throws -> some IntentResult {
        guard let store = NewTaskControlRequestStore() else {
            throw NewTaskControlRequestError.appGroupUnavailable
        }
        try store.record()
        return .result()
    }
}

enum NewTaskControlRequestError: Error {
    case appGroupUnavailable
    case invalidRequest
}

struct NewTaskControlRequestStore {
    static let fileName = "new-task-control-request-v1.txt"

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

    func record(identifier: UUID = UUID()) throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(identifier.uuidString.lowercased().utf8).write(
            to: fileURL,
            options: .atomic
        )
#if os(iOS)
        try FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: fileURL.path
        )
#endif
    }

    @discardableResult
    func consume() throws -> Bool {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return false
        }
        let data = try Data(contentsOf: fileURL)
        guard data.count <= 64,
              let value = String(data: data, encoding: .utf8),
              UUID(uuidString: value) != nil else {
            try? FileManager.default.removeItem(at: fileURL)
            throw NewTaskControlRequestError.invalidRequest
        }
        try FileManager.default.removeItem(at: fileURL)
        return true
    }
}
