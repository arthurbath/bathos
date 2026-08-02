import SwiftUI
import WidgetKit

struct TasksWatchProgressEntry: TimelineEntry {
    let date: Date
    let progress: TaskWatchTodayProgress?
}

struct TasksWatchProgressProvider: TimelineProvider {
    func placeholder(in context: Context) -> TasksWatchProgressEntry {
        TasksWatchProgressEntry(date: Date(), progress: nil)
    }

    func getSnapshot(
        in context: Context,
        completion: @escaping (TasksWatchProgressEntry) -> Void
    ) {
        completion(TasksWatchProgressEntry(
            date: Date(),
            progress: try? TaskWatchProgressStore()?.load()
        ))
    }

    func getTimeline(
        in context: Context,
        completion: @escaping (Timeline<TasksWatchProgressEntry>) -> Void
    ) {
        Task {
            var progress = try? TaskWatchProgressStore()?.load()
            if let credential = try? TaskWatchCredentialStore()?.load(),
               let refreshed = try? await TaskWatchActionsClient().fetchProgress(
                    credential: credential
               ) {
                progress = refreshed
                try? TaskWatchProgressStore()?.store(refreshed)
            }
            let entry = TasksWatchProgressEntry(date: Date(), progress: progress)
            completion(Timeline(
                entries: [entry],
                policy: .after(Date().addingTimeInterval(30 * 60))
            ))
        }
    }
}

struct TasksWatchProgressView: View {
    let entry: TasksWatchProgressEntry

    var body: some View {
        Gauge(value: entry.progress?.fraction ?? 0) {
            Image(systemName: "checkmark")
        } currentValueLabel: {
            Image(systemName: "checkmark")
                .font(.system(size: 15, weight: .semibold))
        }
        .gaugeStyle(.accessoryCircular)
        .widgetAccentable()
        .containerBackground(.clear, for: .widget)
    }
}

struct TasksWatchComplication: Widget {
    let kind = TaskCompanionConstants.watchComplicationKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TasksWatchProgressProvider()) { entry in
            TasksWatchProgressView(entry: entry)
        }
        .configurationDisplayName("Today Progress")
        .description("Shows the share of today's Tasks that are complete.")
        .supportedFamilies([.accessoryCircular])
    }
}

@main
struct TasksWatchWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TasksWatchComplication()
    }
}
