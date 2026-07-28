import AppIntents
import WidgetKit

struct TaskWidgetListOptionsProvider: DynamicOptionsProvider {
    func results() async throws -> [String] {
        TaskWidgetListID.widgetConfigurationCases.map(\.title)
    }

    func defaultResult() async -> String? {
        TaskWidgetListID.today.title
    }
}

struct TaskListSelectionIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Choose Task List"
    static let description = IntentDescription("Select the BathOS task list shown by this widget.")

    @Parameter(title: "List", optionsProvider: TaskWidgetListOptionsProvider())
    var list: String?
}
