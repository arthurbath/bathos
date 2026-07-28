import Foundation

enum TaskWidgetSnapshotError: Error, Equatable {
    case invalidSchema
    case invalidOwner
    case invalidGeneratedAt
    case invalidPlanningDate
    case invalidLists
    case invalidTask
    case oversizedSnapshot
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

struct TaskWidgetTask: Codable, Equatable, Identifiable {
    let id: UUID
    let summary: String
    let deadline: String?
    let todaySection: String?
    let actionability: String
    let terminalState: String?
}

struct TaskWidgetList: Codable, Equatable, Identifiable {
    let id: TaskWidgetListID
    let title: String
    let totalCount: Int
    let truncated: Bool
    let tasks: [TaskWidgetTask]
}

struct TaskWidgetSnapshot: Codable, Equatable {
    static let schemaVersion = 1
    static let maximumEncodedBytes = 512 * 1_024
    static let maximumTasksPerList = 50
    static let maximumSummaryCharacters = 500

    let type: String
    let schemaVersion: Int
    let ownerId: UUID
    var generatedAt: String
    let planningDate: String
    let lists: [TaskWidgetList]

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
        guard ISO8601DateFormatter().date(from: generatedAt) != nil else {
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
                      Self.allowedTerminalStates.contains(task.terminalState) else {
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

    var generatedDate: Date? {
        ISO8601DateFormatter().date(from: generatedAt)
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
