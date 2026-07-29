import SwiftUI
import WidgetKit

@main
struct TasksWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TaskListWidget()
        if #available(iOS 18.0, *) {
            NewTaskControl()
        }
    }
}
