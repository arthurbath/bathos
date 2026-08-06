import Combine
import Foundation

struct TasksNativeQuickEntryArea: Identifiable, Codable, Equatable {
    let id: UUID
    let name: String
}

enum TasksNativeQuickEntryServiceError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Native Quick Entry saving is not connected in this development build."
        }
    }
}

struct TasksNativeQuickEntryPickerRequest: Equatable {
    enum Kind: Equatable {
        case start
        case deadline
    }

    let id = UUID()
    let kind: Kind
}

@MainActor
final class TasksNativeQuickEntryViewModel: ObservableObject {
    typealias SubmitHandler = (TasksNativeQuickEntrySubmission) async throws -> UUID

    @Published var draft: TasksNativeQuickEntryDraft
    @Published var planningDate: TasksNativeCalendarDate
    @Published var areas: [TasksNativeQuickEntryArea]
    @Published private(set) var isRefreshingBootstrap = false
    @Published private(set) var pickerRequest: TasksNativeQuickEntryPickerRequest?

    private let submitHandler: SubmitHandler
    private let onCancel: () -> Void
    private let onAccepted: (UUID) -> Void
    private var submissionTask: Task<Void, Never>?
    private var submissionGeneration: UUID?

    var canSave: Bool {
        guard draft.submissionState != .submitting else { return false }
        return (try? draft.normalizedSubmission(planningDate: planningDate)) != nil
    }

    init(
        draft: TasksNativeQuickEntryDraft = .init(),
        planningDate: TasksNativeCalendarDate = .today,
        areas: [TasksNativeQuickEntryArea] = [],
        submitHandler: @escaping SubmitHandler = { _ in
            throw TasksNativeQuickEntryServiceError.unavailable
        },
        onCancel: @escaping () -> Void = {},
        onAccepted: @escaping (UUID) -> Void = { _ in }
    ) {
        self.draft = draft
        self.planningDate = planningDate
        self.areas = areas
        self.submitHandler = submitHandler
        self.onCancel = onCancel
        self.onAccepted = onAccepted
    }

    func cancel() {
        submissionGeneration = nil
        submissionTask?.cancel()
        submissionTask = nil
        onCancel()
    }

    func reset(using bootstrap: TasksNativeQuickEntryBootstrap? = nil) {
        draft = .init()
        if let bootstrap {
            apply(bootstrap)
        }
    }

    func beginBootstrapRefresh() {
        isRefreshingBootstrap = true
    }

    func finishBootstrapRefresh(
        _ result: Result<TasksNativeQuickEntryBootstrap, Error>
    ) {
        isRefreshingBootstrap = false
        if case let .success(bootstrap) = result {
            apply(bootstrap)
        }
    }

    func save() {
        guard draft.submissionState != .submitting else { return }
        let generation = UUID()
        submissionGeneration = generation
        submissionTask = Task { [weak self] in
            guard let self else { return }
            await submit(generation: generation)
            if submissionGeneration == generation {
                submissionTask = nil
            }
        }
    }

    func submit() async {
        await submit(generation: nil)
    }

    private func submit(generation: UUID?) async {
        guard draft.submissionState != .submitting else { return }
        let submission: TasksNativeQuickEntrySubmission
        do {
            submission = try draft.normalizedSubmission(planningDate: planningDate)
        } catch {
            draft.submissionState = .failed(
                message: error.localizedDescription
            )
            return
        }

        draft.submissionState = .submitting
        do {
            let taskID = try await submitHandler(submission)
            guard !Task.isCancelled,
                  generation == nil || submissionGeneration == generation else {
                return
            }
            draft.submissionState = .accepted(taskID: taskID)
            onAccepted(taskID)
        } catch {
            guard !Task.isCancelled,
                  generation == nil || submissionGeneration == generation else {
                return
            }
            draft.submissionState = .failed(
                message: error.localizedDescription
            )
        }
    }

    func moveFocus(reverse: Bool) {
        draft.moveFocus(reverse: reverse)
    }

    @discardableResult
    func handleControlShortcut(_ key: String) -> Bool {
        guard TasksNativeQuickEntryContract.commands.contains(where: { $0.key == key }) else {
            return false
        }
        let focusedTargetBeforeCommand = draft.focus
        switch key {
        case "e":
            draft.focus = .start
            pickerRequest = .init(kind: .start)
        case "r":
            draft.clearStart()
            draft.focus = .start
        case "t":
            draft.cycleTodaySection()
            draft.focus = .start
        case "y":
            if draft.hasStart {
                if draft.reminderLocalTime == nil {
                    draft.reminderLocalTime = "09:00"
                }
                draft.focus = .reminder
            }
        case "n":
            draft.showsNotes = true
            draft.focus = .notes
            return focusedTargetBeforeCommand == .notes
        case "d":
            draft.focus = .deadline
            pickerRequest = .init(kind: .deadline)
        case "f":
            draft.cycleActionability()
            draft.focus = .actionability
        case "g":
            draft.setSomeday()
            draft.focus = .start
        case "h":
            draft.showsLink = true
            draft.focus = .link
            return focusedTargetBeforeCommand == .link
        case "c":
            if case let .checklist(focusedID) = draft.focus,
               let focusedItem = draft.checklist.first(where: { $0.id == focusedID }),
               focusedItem.title.trimmingCharacters(
                   in: .whitespacesAndNewlines
               ).isEmpty,
               draft.checklist.last?.id == focusedID {
                draft.prependChecklistItem()
            } else {
                draft.appendChecklistItem()
            }
        case "v":
            cycleArea()
            draft.focus = .area
        default:
            break
        }
        return false
    }

    private func cycleArea() {
        let values: [UUID?] = [nil] + areas.map(\.id)
        guard let currentIndex = values.firstIndex(of: draft.areaID) else {
            draft.areaID = nil
            return
        }
        let candidate = values.index(after: currentIndex)
        draft.areaID = candidate == values.endIndex ? nil : values[candidate]
    }

    private func apply(_ bootstrap: TasksNativeQuickEntryBootstrap) {
        if let parsed = TasksNativeQuickEntryDateParser.calendarDate(
            from: bootstrap.planningDate
        ) {
            planningDate = parsed
        }
        areas = bootstrap.areas
        if let areaID = draft.areaID,
           !areas.contains(where: { $0.id == areaID }) {
            draft.areaID = nil
        }
    }
}

extension TasksNativeCalendarDate {
    static var today: Self {
        Self(Date())
    }
}
