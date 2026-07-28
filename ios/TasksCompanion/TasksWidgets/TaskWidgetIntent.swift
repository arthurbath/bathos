import AppIntents
import WidgetKit

struct TaskWidgetListChoice: AppEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Task List")
    static let defaultQuery = TaskWidgetListChoiceQuery()

    let id: String

    init(listID: TaskWidgetListID) {
        id = listID.rawValue
    }

    var listID: TaskWidgetListID {
        TaskWidgetListID(rawValue: id) ?? .today
    }

    var displayRepresentation: DisplayRepresentation {
        switch listID {
        case .today: "Today"
        case .upcoming: "Upcoming"
        case .anytime: "Anytime"
        case .someday: "Someday"
        case .done: "Done"
        }
    }
}

struct TaskWidgetListChoiceQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [TaskWidgetListChoice] {
        let identifiers = Set(identifiers)
        return TaskWidgetListID.allCases
            .filter { identifiers.contains($0.rawValue) }
            .map(TaskWidgetListChoice.init(listID:))
    }

    func suggestedEntities() async throws -> [TaskWidgetListChoice] {
        TaskWidgetListID.allCases.map(TaskWidgetListChoice.init(listID:))
    }

    func defaultResult() async -> TaskWidgetListChoice? {
        TaskWidgetListChoice(listID: .today)
    }
}

struct TaskListSelectionIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Choose Task List"
    static let description = IntentDescription("Select the BathOS task list shown by this widget.")

    @Parameter(title: "List")
    var list: TaskWidgetListChoice?
}
