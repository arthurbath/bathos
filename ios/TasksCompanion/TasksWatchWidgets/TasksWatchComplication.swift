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
        ZStack {
            Circle()
                // Accessory complications are rendered as templates in accented
                // and vibrant modes. Preserve the track/progress distinction in
                // the alpha channel because WidgetKit may discard RGB colors.
                .stroke(Color.primary.opacity(0.24), lineWidth: 5)

            Circle()
                .trim(from: 0, to: entry.progress?.fraction ?? 0)
                .stroke(
                    Color.primary,
                    style: StrokeStyle(lineWidth: 5, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            Image(systemName: "checkmark")
                .font(.system(size: 16, weight: .black))
                .foregroundStyle(.primary)
        }
        .padding(3)
        .widgetURL(TaskWatchCaptureLaunchPolicy.captureURL)
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
