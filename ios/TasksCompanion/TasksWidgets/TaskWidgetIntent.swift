import AppIntents
import WidgetKit

enum TaskWidgetListChoice: String, AppEnum {
    case today
    case upcoming
    case anytime
    case someday
    case done

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Task List")
    static let caseDisplayRepresentations: [TaskWidgetListChoice: DisplayRepresentation] = [
        .today: "Today",
        .upcoming: "Upcoming",
        .anytime: "Anytime",
        .someday: "Someday",
        .done: "Done",
    ]

    var listID: TaskWidgetListID {
        TaskWidgetListID(rawValue: rawValue) ?? .today
    }
}

struct TaskListSelectionIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Choose Task List"
    static let description = IntentDescription("Select the BathOS task list shown by this widget.")

    @Parameter(title: "List", default: .today)
    var list: TaskWidgetListChoice
}
