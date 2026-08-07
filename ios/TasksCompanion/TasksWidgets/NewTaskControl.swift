import SwiftUI
import WidgetKit

@available(iOS 18.0, *)
struct NewTaskControl: ControlWidget {
    static let kind = "garden.bath.tasks.new-task-control"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(
                action: OpenNewTaskIntent(target: .todayInbox)
            ) {
                Label("New Task", systemImage: "plus.square")
            }
        }
        .displayName("New Task")
        .description("Create a task in Today Inbox.")
    }
}
