import Foundation

struct TasksNativeCalendarDate: Codable, Comparable, Equatable, Hashable {
    let year: Int
    let month: Int
    let day: Int

    init(year: Int, month: Int, day: Int) throws {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = TimeZone(secondsFromGMT: 0)
        components.year = year
        components.month = month
        components.day = day

        guard
            let date = components.date,
            components.calendar?.dateComponents([.year, .month, .day], from: date)
                == DateComponents(year: year, month: month, day: day)
        else {
            throw TasksNativeQuickEntryDraftError.invalidCalendarDate
        }

        self.year = year
        self.month = month
        self.day = day
    }

    init(_ date: Date, calendar: Calendar = .current) {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        year = components.year ?? 1
        month = components.month ?? 1
        day = components.day ?? 1
    }

    static func < (lhs: Self, rhs: Self) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }

    var iso8601: String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    func date(calendar: Calendar = .current) -> Date? {
        var components = DateComponents()
        components.calendar = calendar
        components.timeZone = calendar.timeZone
        components.year = year
        components.month = month
        components.day = day
        return components.date
    }
}

struct TasksNativeQuickEntryChecklistItem: Identifiable, Equatable {
    let id: UUID
    var title: String

    init(id: UUID = UUID(), title: String = "") {
        self.id = id
        self.title = title
    }
}

enum TasksNativeQuickEntryFocusTarget: Hashable {
    case summary
    case notes
    case link
    case checklist(UUID)
    case start
    case reminder
    case deadline
    case area
    case actionability
    case checklistDisclosure
    case cancel
    case save
}

enum TasksNativeQuickEntrySubmissionState: Equatable {
    case editing
    case submitting
    case failed(message: String)
    case accepted(taskID: UUID)
}

enum TasksNativeQuickEntryDraftError: Error, Equatable, LocalizedError {
    case invalidCalendarDate
    case summaryRequired
    case fieldTooLong(field: String, maximum: Int)
    case tooManyChecklistItems(maximum: Int)
    case startBeforePlanningDate
    case reminderRequiresStart
    case invalidReminderTime
    case invalidTodaySection
    case invalidActionability

    var errorDescription: String? {
        switch self {
        case .invalidCalendarDate:
            return "The date is invalid."
        case .summaryRequired:
            return "A task summary is required."
        case let .fieldTooLong(field, maximum):
            return "\(field) cannot contain more than \(maximum) characters."
        case let .tooManyChecklistItems(maximum):
            return "A checklist cannot contain more than \(maximum) items."
        case .startBeforePlanningDate:
            return "The start date cannot be before the planning date."
        case .reminderRequiresStart:
            return "A reminder requires a start date or Today horizon."
        case .invalidReminderTime:
            return "The reminder time is invalid."
        case .invalidTodaySection:
            return "The Today horizon is invalid."
        case .invalidActionability:
            return "The actionability is invalid."
        }
    }
}

struct TasksNativeQuickEntrySubmission: Codable, Equatable {
    struct ChecklistItem: Codable, Equatable {
        let clientID: UUID
        let title: String
        let position: Int
    }

    let payloadSchemaVersion: Int
    let contractFingerprint: String
    let clientMutationID: UUID
    let operationID: UUID
    let summary: String
    let notes: String?
    let link: String?
    let checklist: [ChecklistItem]
    let destination: String
    let todaySection: String?
    let startDate: String?
    let reminderLocalTime: String?
    let deadlineDate: String?
    let areaID: UUID?
    let actionability: String
}

struct TasksNativeQuickEntryDraft: Equatable {
    let clientMutationID: UUID
    let operationID: UUID

    var summary = ""
    var notes = ""
    var link = ""
    var checklist: [TasksNativeQuickEntryChecklistItem] = []
    var destination = TasksNativeQuickEntryContract.defaultDestination
    var todaySection: String? = TasksNativeQuickEntryContract.defaultTodaySection
    var startDate: TasksNativeCalendarDate?
    var reminderLocalTime: String?
    var deadlineDate: TasksNativeCalendarDate?
    var areaID: UUID?
    var actionability = TasksNativeQuickEntryContract.defaultActionability

    var showsNotes = false
    var showsLink = false
    var showsChecklist = false
    var focus: TasksNativeQuickEntryFocusTarget = .summary
    var submissionState: TasksNativeQuickEntrySubmissionState = .editing

    init(
        clientMutationID: UUID = UUID(),
        operationID: UUID = UUID()
    ) {
        self.clientMutationID = clientMutationID
        self.operationID = operationID
    }

    var hasStart: Bool {
        startDate != nil || todaySection != nil
    }

    var availableFocusTargets: [TasksNativeQuickEntryFocusTarget] {
        var targets: [TasksNativeQuickEntryFocusTarget] = []
        for field in TasksNativeQuickEntryContract.fields {
            switch field.id {
            case .summary:
                targets.append(.summary)
            case .notes:
                targets.append(.notes)
            case .link:
                targets.append(.link)
            case .checklist:
                if checklist.isEmpty {
                    targets.append(.checklistDisclosure)
                } else {
                    targets.append(contentsOf: checklist.map {
                        TasksNativeQuickEntryFocusTarget.checklist($0.id)
                    })
                }
            case .start:
                targets.append(.start)
            case .reminder:
                if reminderLocalTime != nil {
                    targets.append(.reminder)
                }
            case .deadline:
                targets.append(.deadline)
            case .area:
                targets.append(.area)
            case .actionability:
                targets.append(.actionability)
            }
        }
        targets.append(contentsOf: [.cancel, .save])
        return targets
    }

    mutating func moveFocus(reverse: Bool) {
        let targets = availableFocusTargets
        guard !targets.isEmpty else { return }
        guard let currentIndex = targets.firstIndex(of: focus) else {
            focus = reverse ? targets[targets.index(before: targets.endIndex)] : targets[0]
            return
        }
        if reverse {
            focus = currentIndex == targets.startIndex
                ? targets[targets.index(before: targets.endIndex)]
                : targets[targets.index(before: currentIndex)]
        } else {
            let nextIndex = targets.index(after: currentIndex)
            focus = nextIndex == targets.endIndex ? targets[0] : targets[nextIndex]
        }
    }

    mutating func setTodaySection(_ value: String) {
        destination = "anytime"
        todaySection = value
        startDate = nil
    }

    mutating func setExplicitStart(_ value: TasksNativeCalendarDate) {
        destination = "anytime"
        todaySection = nil
        startDate = value
    }

    mutating func clearStart() {
        destination = "anytime"
        todaySection = nil
        startDate = nil
        reminderLocalTime = nil
    }

    mutating func setSomeday() {
        destination = "someday"
        todaySection = nil
        startDate = nil
        reminderLocalTime = nil
    }

    mutating func cycleTodaySection() {
        let values = TasksNativeQuickEntryContract.todaySections.map(\.value)
        let nextIndex: Int
        if let todaySection, let currentIndex = values.firstIndex(of: todaySection) {
            nextIndex = values.index(after: currentIndex) == values.endIndex
                ? values.startIndex
                : values.index(after: currentIndex)
        } else {
            nextIndex = values.startIndex
        }
        setTodaySection(values[nextIndex])
    }

    mutating func cycleActionability() {
        let values = TasksNativeQuickEntryContract.actionabilities.map(\.value)
        guard !values.isEmpty else { return }
        guard let currentIndex = values.firstIndex(of: actionability) else {
            actionability = values[0]
            return
        }
        let candidate = values.index(after: currentIndex)
        actionability = candidate == values.endIndex ? values[0] : values[candidate]
    }

    @discardableResult
    mutating func appendChecklistItem(
        title: String = "",
        id: UUID = UUID()
    ) -> UUID {
        showsChecklist = true
        checklist.append(.init(id: id, title: title))
        focus = .checklist(id)
        return id
    }

    @discardableResult
    mutating func prependChecklistItem(
        title: String = "",
        id: UUID = UUID()
    ) -> UUID {
        showsChecklist = true
        checklist.insert(.init(id: id, title: title), at: checklist.startIndex)
        focus = .checklist(id)
        return id
    }

    @discardableResult
    mutating func insertChecklistItem(after itemID: UUID) -> UUID {
        let newID = UUID()
        let insertionIndex = checklist.firstIndex { $0.id == itemID }
            .map { checklist.index(after: $0) }
            ?? checklist.endIndex
        checklist.insert(.init(id: newID), at: insertionIndex)
        showsChecklist = true
        focus = .checklist(newID)
        return newID
    }

    mutating func removeChecklistItem(id: UUID) {
        let removedIndex = checklist.firstIndex { $0.id == id }
        checklist.removeAll { $0.id == id }
        if checklist.isEmpty {
            showsChecklist = false
            focus = .summary
        } else if focus == .checklist(id), let removedIndex {
            let nextIndex = min(removedIndex, checklist.index(before: checklist.endIndex))
            focus = .checklist(checklist[nextIndex].id)
        }
    }

    mutating func discardBlankChecklistItems(except retainedID: UUID? = nil) {
        checklist.removeAll {
            $0.id != retainedID && Self.trimmedOptional($0.title) == nil
        }
        if checklist.isEmpty {
            showsChecklist = false
        }
    }

    mutating func moveChecklistItems(fromOffsets: IndexSet, toOffset: Int) {
        let moving = fromOffsets.sorted().map { checklist[$0] }
        for index in fromOffsets.sorted(by: >) {
            checklist.remove(at: index)
        }
        let removedBeforeDestination = fromOffsets.filter { $0 < toOffset }.count
        let destination = max(0, min(checklist.count, toOffset - removedBeforeDestination))
        checklist.insert(contentsOf: moving, at: destination)
    }

    func normalizedSubmission(
        planningDate: TasksNativeCalendarDate
    ) throws -> TasksNativeQuickEntrySubmission {
        let normalizedSummary = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedSummary.isEmpty else {
            throw TasksNativeQuickEntryDraftError.summaryRequired
        }

        try Self.validateLength(
            normalizedSummary,
            fieldID: .summary
        )
        try Self.validateLength(notes, fieldID: .notes)
        try Self.validateLength(link, fieldID: .link)

        let normalizedChecklist = checklist.compactMap { item -> (UUID, String)? in
            guard let title = Self.trimmedOptional(item.title) else { return nil }
            return (item.id, title)
        }
        guard normalizedChecklist.count <= TasksNativeQuickEntryContract.maximumChecklistItems else {
            throw TasksNativeQuickEntryDraftError.tooManyChecklistItems(
                maximum: TasksNativeQuickEntryContract.maximumChecklistItems
            )
        }
        for (_, title) in normalizedChecklist {
            try Self.validateLength(title, fieldID: .checklist)
        }

        let todaySectionValues = Set(TasksNativeQuickEntryContract.todaySections.map(\.value))
        if let todaySection, !todaySectionValues.contains(todaySection) {
            throw TasksNativeQuickEntryDraftError.invalidTodaySection
        }

        let actionabilityValues = Set(TasksNativeQuickEntryContract.actionabilities.map(\.value))
        guard actionabilityValues.contains(actionability) else {
            throw TasksNativeQuickEntryDraftError.invalidActionability
        }

        if let startDate, startDate < planningDate {
            throw TasksNativeQuickEntryDraftError.startBeforePlanningDate
        }

        let normalizedReminder = Self.trimmedOptional(reminderLocalTime)
        if normalizedReminder != nil && !hasStart {
            throw TasksNativeQuickEntryDraftError.reminderRequiresStart
        }
        if let normalizedReminder,
           !Self.isValidReminderLocalTime(normalizedReminder) {
            throw TasksNativeQuickEntryDraftError.invalidReminderTime
        }

        return TasksNativeQuickEntrySubmission(
            payloadSchemaVersion: TasksNativeQuickEntryContract.payloadSchemaVersion,
            contractFingerprint: TasksNativeQuickEntryContract.sourceFingerprint,
            clientMutationID: clientMutationID,
            operationID: operationID,
            summary: normalizedSummary,
            notes: Self.trimmedOptional(notes),
            link: Self.trimmedOptional(link),
            checklist: normalizedChecklist.enumerated().map { index, item in
                .init(clientID: item.0, title: item.1, position: index)
            },
            destination: destination,
            todaySection: todaySection,
            startDate: startDate?.iso8601,
            reminderLocalTime: normalizedReminder,
            deadlineDate: deadlineDate?.iso8601,
            areaID: areaID,
            actionability: actionability
        )
    }

    private static func trimmedOptional(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func validateLength(
        _ value: String,
        fieldID: TasksNativeQuickEntryContract.FieldID
    ) throws {
        guard
            let field = TasksNativeQuickEntryContract.fields.first(where: { $0.id == fieldID }),
            let maximum = field.maximumCharacters
        else { return }
        guard value.unicodeScalars.count <= maximum else {
            throw TasksNativeQuickEntryDraftError.fieldTooLong(
                field: field.label,
                maximum: maximum
            )
        }
    }

    private static func isValidReminderLocalTime(_ value: String) -> Bool {
        guard value.count == 5 else { return false }
        let pieces = value.split(separator: ":", omittingEmptySubsequences: false)
        guard
            pieces.count == 2,
            pieces[0].count == 2,
            pieces[1].count == 2,
            let hour = Int(pieces[0]),
            let minute = Int(pieces[1])
        else {
            return false
        }
        return (0...23).contains(hour) && (0...59).contains(minute)
    }
}
