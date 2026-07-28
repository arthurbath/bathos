import AppIntents
import OSLog
import SwiftUI
import WidgetKit

private let taskWidgetLogger = Logger(
    subsystem: "garden.bath.tasks.widgets",
    category: "timeline-provider"
)

private struct CompleteTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Complete Task"
    static let openAppWhenRun = false

    @Parameter(title: "Task")
    var taskID: String

    init() {
        taskID = ""
    }

    init(taskID: String) {
        self.taskID = taskID
    }

    func perform() async throws -> some IntentResult {
        do {
            guard let taskUUID = UUID(uuidString: taskID),
                  let credentialStore = TaskWidgetCredentialStore(),
                  let credential = try credentialStore.load(),
                  let snapshotStore = TaskWidgetStore() else {
                return .result()
            }
            guard let completion = await TaskWidgetCompletionClient().complete(
                taskID: taskUUID,
                credential: credential
            ) else {
                return .result()
            }

            try? await Task.sleep(nanoseconds: 350_000_000)
            if var snapshot = try snapshotStore.load() {
                let completedAt = completion.completedAt
                    ?? ISO8601DateFormatter().string(from: Date())
                if snapshot.completeTask(taskUUID, completedAt: completedAt) {
                    _ = try snapshotStore.store(snapshot)
                }
            }
            WidgetCenter.shared.reloadTimelines(ofKind: TaskCompanionConstants.widgetKind)
            return .result()
        } catch {
            return .result()
        }
    }
}

struct TaskListWidgetEntry: TimelineEntry {
    let date: Date
    let listID: TaskWidgetListID
    let snapshot: TaskWidgetSnapshot?
    let list: TaskWidgetList?
}

struct TaskListWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> TaskListWidgetEntry {
        TaskListWidgetEntry(
            date: Date(),
            listID: .today,
            snapshot: nil,
            list: TaskWidgetList(
                id: .today,
                title: "Today",
                totalCount: 3,
                truncated: false,
                tasks: [
                    previewTask("Review Today"),
                    previewTask("Plan Next"),
                    previewTask("Read Later"),
                ]
            )
        )
    }

    func snapshot(
        for configuration: TaskListSelectionIntent,
        in context: Context
    ) async -> TaskListWidgetEntry {
        entry(for: configuration)
    }

    func timeline(
        for configuration: TaskListSelectionIntent,
        in context: Context
    ) async -> Timeline<TaskListWidgetEntry> {
        let entry = entry(for: configuration)
        return Timeline(
            entries: [entry],
            policy: .after(Date().addingTimeInterval(30 * 60))
        )
    }

    private func entry(for configuration: TaskListSelectionIntent) -> TaskListWidgetEntry {
        let configuredValue = configuration.list ?? TaskWidgetListID.today.title
        let listID = TaskWidgetListID(rawValue: configuredValue.lowercased()) ?? .today
        taskWidgetLogger.notice(
            "Resolved widget list parameter \(configuredValue, privacy: .public) as \(listID.rawValue, privacy: .public)"
        )
        let snapshot = try? TaskWidgetStore()?.load()
        return TaskListWidgetEntry(
            date: Date(),
            listID: listID,
            snapshot: snapshot,
            list: snapshot?.list(listID)
        )
    }

    private func previewTask(_ summary: String) -> TaskWidgetTask {
        TaskWidgetTask(
            id: UUID(),
            summary: summary,
            deadline: nil,
            todaySection: nil,
                        actionability: "actionable",
                        terminalState: nil,
                        primaryLink: nil
        )
    }
}

struct TaskListWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: TaskCompanionConstants.widgetKind,
            intent: TaskListSelectionIntent.self,
            provider: TaskListWidgetProvider()
        ) { entry in
            TaskListWidgetView(entry: entry)
                .containerBackground(Color.black, for: .widget)
        }
        .configurationDisplayName("Tasks List")
        .description("Show a selected BathOS task list.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

private struct TaskListWidgetView: View {
    let entry: TaskListWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
                .overlay(Color.white.opacity(0.16))
                .padding(.bottom, 6)
            content
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .foregroundStyle(.white)
        .widgetURL(TaskNativeRoute.list(entry.listID).deepLinkURL)
    }

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: headerSymbol)
                .foregroundStyle(headerColor)
                .font(.system(size: 17, weight: .semibold))
            Text(entry.listID.title)
                .font(.headline)
                .lineLimit(1)
            Spacer()
            if let list = entry.list {
                Text("\(list.totalCount)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.bottom, 9)
    }

    @ViewBuilder
    private var content: some View {
        if let list = entry.list {
            if list.tasks.isEmpty {
                emptyState("No tasks")
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(list.tasks.prefix(8)) { task in
                        HStack(spacing: 9) {
                            if task.terminalState == nil {
                                Button(intent: CompleteTaskIntent(
                                    taskID: task.id.uuidString.lowercased()
                                )) {
                                    Image(systemName: taskSymbol(task))
                                        .font(.system(size: 14, weight: .regular))
                                        .foregroundStyle(taskColor(task))
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Complete \(task.summary)")
                            } else {
                                Image(systemName: taskSymbol(task))
                                    .font(.system(size: 14, weight: .regular))
                                    .foregroundStyle(taskColor(task))
                            }
                            Link(
                                destination: TaskNativeRoute.task(
                                    task.id,
                                    list: entry.listID
                                ).deepLinkURL
                            ) {
                                Text(task.summary)
                                    .font(.system(size: 14))
                                    .lineLimit(1)
                                    .privacySensitive()
                            }
                            .buttonStyle(.plain)
                            Spacer(minLength: 0)
                            if let primaryLink = task.primaryLink,
                               let destination = primaryLink.url {
                                Link(destination: destination) {
                                    Image(systemName: primaryLink.kind == .mail
                                        ? "envelope"
                                        : "arrow.up.right.square"
                                    )
                                    .font(.system(size: 13))
                                    .foregroundStyle(.secondary)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(
                                    primaryLink.kind == .mail
                                        ? "Open Message"
                                        : "Open Primary Link"
                                )
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 29, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    if list.truncated || list.totalCount > min(list.tasks.count, 8) {
                        Text("+\(list.totalCount - min(list.totalCount, 8)) More")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.top, 5)
                    }
                    if isStale {
                        Label("Open Tasks to Refresh", systemImage: "arrow.clockwise")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .padding(.top, 5)
                    }
                }
            }
        } else {
            emptyState("Open BathOS Tasks")
        }
    }

    private func emptyState(_ message: String) -> some View {
        VStack(spacing: 8) {
            Spacer()
            Image(systemName: entry.snapshot == nil ? "rectangle.and.hand.point.up.left" : "checkmark")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var isStale: Bool {
        guard let date = entry.snapshot?.generatedDate else {
            return false
        }
        return entry.date.timeIntervalSince(date) > 4 * 60 * 60
    }

    private var headerSymbol: String {
        switch entry.listID {
        case .today: "star"
        case .upcoming: "calendar"
        case .anytime: "checklist"
        case .someday: "square.dashed"
        case .done: "checklist.checked"
        }
    }

    private var headerColor: Color {
        entry.listID == .today ? .yellow : .white
    }

    private func taskSymbol(_ task: TaskWidgetTask) -> String {
        if task.terminalState == "deleted" {
            return "trash"
        }
        if task.terminalState != nil {
            return "checkmark.square"
        }
        return entry.listID == .someday ? "square.dashed" : "square"
    }

    private func taskColor(_ task: TaskWidgetTask) -> Color {
        if task.terminalState == "deleted" {
            return .red
        }
        if task.terminalState != nil {
            return .green
        }
        switch task.todaySection {
        case "inbox": return .green
        case "now": return .yellow
        case "next": return .orange
        case "later": return .purple
        default: return .secondary
        }
    }
}
