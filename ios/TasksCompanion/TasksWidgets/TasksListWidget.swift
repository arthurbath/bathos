import AppIntents
import OSLog
import SwiftUI
import WidgetKit

private let taskWidgetLogger = Logger(
    subsystem: "garden.bath.tasks.widgets",
    category: "timeline-provider"
)

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
        let entry = await refreshedEntry(for: configuration)
        return Timeline(
            entries: [entry],
            policy: .after(Date().addingTimeInterval(30 * 60))
        )
    }

    private func entry(for configuration: TaskListSelectionIntent) -> TaskListWidgetEntry {
        let configuredValue = configuration.list ?? TaskWidgetListID.today.title
        let listID = TaskWidgetListID.widgetConfigurationValue(configuration.list)
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

    private func refreshedEntry(
        for configuration: TaskListSelectionIntent
    ) async -> TaskListWidgetEntry {
        guard let credentialStore = TaskWidgetCredentialStore(),
              let snapshotStore = TaskWidgetStore() else {
            return entry(for: configuration)
        }
        let snapshot = await TaskWidgetBackgroundRefresher(
            credentialStore: credentialStore,
            snapshotStore: snapshotStore,
            client: TaskWidgetSnapshotClient()
        ).refresh()
        let configuredValue = configuration.list ?? TaskWidgetListID.today.title
        let listID = TaskWidgetListID.widgetConfigurationValue(configuration.list)
        taskWidgetLogger.notice(
            "Refreshed widget list parameter \(configuredValue, privacy: .public) as \(listID.rawValue, privacy: .public)"
        )
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
            TaskListWidgetRootView(entry: entry)
        }
        .configurationDisplayName("Tasks List")
        .description("Show a selected BathOS task list.")
        .supportedFamilies(TaskWidgetPlatformPolicy.supportedFamilies)
        .contentMarginsDisabled()
    }
}

private struct TaskListWidgetRootView: View {
    @Environment(\.widgetFamily) private var family

    let entry: TaskListWidgetEntry

    @ViewBuilder
    var body: some View {
        switch family {
#if os(iOS)
        case .accessoryRectangular:
            TaskListLockScreenWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Color.clear
                }
#endif
        default:
            TaskListWidgetView(entry: entry)
                .containerBackground(Color.black, for: .widget)
        }
    }
}

#if os(iOS)
private struct TaskListLockScreenWidgetView: View {
    let entry: TaskListWidgetEntry

    var body: some View {
        Group {
            if let list = entry.list {
                if list.tasks.isEmpty {
                    emptyState("No tasks")
                } else {
                    let visibleTasks = Array(
                        list.tasks.prefix(
                            TaskWidgetPresentationPolicy.lockScreenTaskLimit
                        )
                    )
                    let centersTasks = TaskWidgetPresentationPolicy
                        .verticallyCentersLockScreenTasks(
                            taskCount: visibleTasks.count
                        )

                    VStack(
                        alignment: .leading,
                        spacing: TaskWidgetPresentationPolicy
                            .lockScreenTaskRowSpacing
                    ) {
                        ForEach(
                            visibleTasks
                        ) { task in
                            HStack(spacing: 5) {
                                Image(systemName: TaskWidgetPresentationPolicy
                                    .lockScreenLeadingSystemImageName)
                                .font(.system(size: 10, weight: .regular))
                                Text(task.summary)
                                    .font(.system(
                                        size: 13,
                                        weight: .regular,
                                        design: .default
                                    ))
                                    .lineLimit(1)
                                    .privacySensitive()
                                Spacer(minLength: 0)
                            }
                            .frame(
                                maxWidth: .infinity,
                                minHeight: TaskWidgetPresentationPolicy
                                    .lockScreenTaskRowMinimumHeight,
                                alignment: .leading
                            )
                        }
                    }
                    .frame(
                        maxWidth: .infinity,
                        maxHeight: .infinity,
                        alignment: centersTasks ? .leading : .topLeading
                    )
                }
            } else {
                emptyState("Open Tasks")
            }
        }
        .frame(
            maxWidth: .infinity,
            maxHeight: .infinity,
            alignment: .topLeading
        )
        .foregroundStyle(.primary)
        .widgetURL(
            TaskWidgetPresentationPolicy.lockScreenURL(for: entry.listID)
        )
    }

    private func emptyState(_ message: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: entry.snapshot == nil
                ? "rectangle.and.hand.point.up.left"
                : "checkmark"
            )
            .font(.system(size: 11, weight: .regular))
            Text(message)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
                .privacySensitive()
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}
#endif

private struct TaskListWidgetView: View {
    let entry: TaskListWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
                .overlay(Color.white.opacity(0.16))
                .padding(.bottom, 6)
            content
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .foregroundStyle(.white)
    }

    private var header: some View {
        HStack(spacing: 8) {
            Link(destination: TaskNativeRoute.list(entry.listID).deepLinkURL) {
                HStack(spacing: 8) {
                    TaskWidgetLucideListIcon(listID: entry.listID)
                        .frame(width: 17, height: 17)
                    Text(entry.listID.title)
                        .font(.headline)
                        .lineLimit(1)
                }
            }
            .buttonStyle(.plain)
            Spacer()
            Link(
                destination: TaskWidgetPresentationPolicy.largeWidgetNewTaskURL(
                    for: entry.listID
                )
            ) {
                Image(systemName: "plus")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add Task to \(entry.listID.title)")
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
                    ForEach(list.tasks.prefix(TaskWidgetPresentationPolicy.largeWidgetTaskLimit)) { task in
                        HStack(spacing: 9) {
                            if task.isRecurrenceProjection == true
                                && entry.listID == .upcoming {
                                Image(systemName: "repeat")
                                    .font(.system(size: 14, weight: .regular))
                                    .foregroundStyle(.secondary)
                                    .frame(width: 28, height: 28)
                                    .accessibilityLabel("Repeating Schedule")
                            } else if task.terminalState == nil {
                                Toggle(
                                    isOn: false,
                                    intent: CompleteTaskIntent(
                                        taskID: task.id.uuidString.lowercased()
                                    )
                                ) {
                                    EmptyView()
                                }
                                .toggleStyle(TaskWidgetCompletionToggleStyle(
                                    someday: entry.listID == .someday
                                ))
                                .accessibilityLabel("Complete \(task.summary)")
                            } else {
                                Image(systemName: taskSymbol(task))
                                    .font(.system(size: 14, weight: .regular))
                                    .foregroundStyle(taskColor(task))
                            }
                            TaskWidgetListContext(
                                listID: entry.listID,
                                task: task,
                                planningDate: entry.snapshot?.planningDate
                            )
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
                                    primaryLinkLabel(primaryLink)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(primaryLink.accessibilityLabel)
                            }
                        }
                        .frame(
                            maxWidth: .infinity,
                            minHeight: TaskWidgetPresentationPolicy
                                .largeWidgetTaskRowMinimumHeight,
                            alignment: .leading
                        )
                        .contentShape(Rectangle())
                    }
                }
            }
        } else {
            emptyState("Open BathOS Tasks")
        }
    }

    private func primaryLinkLabel(_ primaryLink: TaskWidgetPrimaryLink) -> some View {
        Image(systemName: primaryLink.systemImageName)
        .font(.system(size: 13))
        .foregroundStyle(.blue)
        .frame(width: 28, height: 28)
        .contentShape(Rectangle())
    }

    private func emptyState(_ message: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: entry.snapshot == nil ? "rectangle.and.hand.point.up.left" : "checkmark")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .padding(.top, 8)
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
        return .secondary
    }
}

private struct TaskWidgetListContext: View {
    let listID: TaskWidgetListID
    let task: TaskWidgetTask
    let planningDate: String?

    @ViewBuilder
    var body: some View {
        if listID == .today, let horizon = task.todaySection {
            TaskWidgetHorizonMarker(horizon: horizon)
        } else if listID == .upcoming,
                  let planningDate,
                  let label = TaskWidgetPresentationPolicy.upcomingDateLabel(
                    upcomingDate: task.upcomingDate,
                    planningDate: planningDate
                  ) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(Color.white.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .accessibilityLabel("Starts \(label)")
        }
    }
}

private struct TaskWidgetHorizonMarker: View {
    let horizon: String

    var body: some View {
        Group {
            if horizon == "inbox" {
                Image(systemName: "tray")
                    .font(.system(size: 12, weight: .regular))
            } else {
                TaskWidgetClockMarker(hour: hour)
            }
        }
        .foregroundStyle(color)
        .frame(width: 15, height: 15)
        .accessibilityLabel(accessibilityLabel)
    }

    private var hour: Int {
        switch horizon {
        case "now":
            return 2
        case "later":
            return 8
        default:
            return 5
        }
    }

    private var color: Color {
        switch horizon {
        case "inbox":
            return Color(red: 52 / 255, green: 178 / 255, blue: 104 / 255)
        case "now":
            return Color(red: 244 / 255, green: 206 / 255, blue: 52 / 255)
        case "next":
            return Color(red: 241 / 255, green: 118 / 255, blue: 65 / 255)
        default:
            return Color(red: 220 / 255, green: 106 / 255, blue: 171 / 255)
        }
    }

    private var accessibilityLabel: String {
        horizon.prefix(1).uppercased() + horizon.dropFirst()
    }
}

private struct TaskWidgetClockMarker: View {
    let hour: Int

    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let radius = min(size.width, size.height) * 0.42
            var clock = Path()
            clock.addEllipse(in: CGRect(
                x: center.x - radius,
                y: center.y - radius,
                width: radius * 2,
                height: radius * 2
            ))
            clock.move(to: center)
            clock.addLine(to: CGPoint(x: center.x, y: center.y - radius * 0.58))
            let angle = CGFloat(hour) * .pi / 6 - .pi / 2
            clock.move(to: center)
            clock.addLine(to: CGPoint(
                x: center.x + cos(angle) * radius * 0.52,
                y: center.y + sin(angle) * radius * 0.52
            ))
            context.stroke(
                clock,
                with: .foreground,
                style: StrokeStyle(
                    lineWidth: 1.6,
                    lineCap: .round,
                    lineJoin: .round
                )
            )
        }
    }
}

#if DEBUG && os(iOS)
private struct TaskListLockScreenWidgetViewPreviews: PreviewProvider {
    static var previews: some View {
        Group {
            preview(
                name: "Three Tasks",
                entry: entry(
                    tasks: [
                        task("Review Today"),
                        task("Plan Next"),
                        task("Read Later"),
                    ]
                )
            )
            preview(
                name: "One Task",
                entry: entry(tasks: [task("Review Today")])
            )
            preview(
                name: "Empty",
                entry: entry(tasks: [])
            )
            preview(
                name: "Unavailable",
                entry: TaskListWidgetEntry(
                    date: Date(),
                    listID: .today,
                    snapshot: nil,
                    list: nil
                )
            )
        }
    }

    private static func preview(
        name: String,
        entry: TaskListWidgetEntry
    ) -> some View {
        TaskListWidgetRootView(entry: entry)
            .previewContext(
                WidgetPreviewContext(family: .accessoryRectangular)
            )
            .previewDisplayName(name)
    }

    private static func entry(
        tasks: [TaskWidgetTask]
    ) -> TaskListWidgetEntry {
        TaskListWidgetEntry(
            date: Date(),
            listID: .today,
            snapshot: nil,
            list: TaskWidgetList(
                id: .today,
                title: "Today",
                totalCount: tasks.count,
                truncated: false,
                tasks: tasks
            )
        )
    }

    private static func task(_ summary: String) -> TaskWidgetTask {
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
#endif

private struct TaskWidgetCompletionToggleStyle: ToggleStyle {
    let someday: Bool

    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            Image(systemName: configuration.isOn
                ? "checkmark.square"
                : someday ? "square.dashed" : "square"
            )
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(configuration.isOn ? Color.green : Color.secondary)
            .frame(width: 28, height: 28)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct TaskWidgetLucideListIcon: View {
    let listID: TaskWidgetListID

    var body: some View {
        Canvas { context, size in
            var path = Path()
            let x = { (value: Double) in value * size.width / 24 }
            let y = { (value: Double) in value * size.height / 24 }
            let point = { (xValue: Double, yValue: Double) in
                CGPoint(x: x(xValue), y: y(yValue))
            }

            switch listID {
            case .today:
                let center = point(12, 12)
                let outerRadius = min(size.width, size.height) * 0.42
                let innerRadius = outerRadius * 0.46
                for index in 0..<10 {
                    let angle = -Double.pi / 2 + Double(index) * Double.pi / 5
                    let radius = index.isMultiple(of: 2) ? outerRadius : innerRadius
                    let vertex = CGPoint(
                        x: center.x + CGFloat(cos(angle)) * radius,
                        y: center.y + CGFloat(sin(angle)) * radius
                    )
                    index == 0 ? path.move(to: vertex) : path.addLine(to: vertex)
                }
                path.closeSubpath()
            case .upcoming:
                path.addRoundedRect(
                    in: CGRect(x: x(3), y: y(4), width: x(18), height: y(18)),
                    cornerSize: CGSize(width: x(2), height: y(2))
                )
                addLine(&path, from: point(16, 2), to: point(16, 6))
                addLine(&path, from: point(3, 10), to: point(21, 10))
                addLine(&path, from: point(8, 2), to: point(8, 6))
                addLine(&path, from: point(17, 14), to: point(11, 14))
                addLine(&path, from: point(13, 18), to: point(7, 18))
                addLine(&path, from: point(7, 14), to: point(7.01, 14))
                addLine(&path, from: point(17, 18), to: point(17.01, 18))
            case .anytime:
                addLine(&path, from: point(13, 5), to: point(21, 5))
                addLine(&path, from: point(13, 12), to: point(21, 12))
                addLine(&path, from: point(13, 19), to: point(21, 19))
                path.move(to: point(3, 17))
                path.addLine(to: point(5, 19))
                path.addLine(to: point(9, 15))
                path.addRoundedRect(
                    in: CGRect(x: x(3), y: y(4), width: x(6), height: y(6)),
                    cornerSize: CGSize(width: x(1), height: y(1))
                )
            case .someday:
                path.addRoundedRect(
                    in: CGRect(x: x(3), y: y(3), width: x(18), height: y(18)),
                    cornerSize: CGSize(width: x(2), height: y(2))
                )
            case .done:
                addLine(&path, from: point(13, 5), to: point(21, 5))
                addLine(&path, from: point(13, 12), to: point(21, 12))
                addLine(&path, from: point(13, 19), to: point(21, 19))
                path.move(to: point(3, 5))
                path.addLine(to: point(5, 7))
                path.addLine(to: point(9, 3))
                path.move(to: point(3, 12))
                path.addLine(to: point(5, 14))
                path.addLine(to: point(9, 10))
                path.move(to: point(3, 19))
                path.addLine(to: point(5, 21))
                path.addLine(to: point(9, 17))
            }

            let dash: [CGFloat] = listID == .someday ? [2.2, 3.2] : []
            context.stroke(
                path,
                with: .color(.primary),
                style: StrokeStyle(
                    lineWidth: max(1.4, size.width / 12),
                    lineCap: .round,
                    lineJoin: .round,
                    dash: dash
                )
            )
        }
        .accessibilityHidden(true)
    }

    private func addLine(_ path: inout Path, from: CGPoint, to: CGPoint) {
        path.move(to: from)
        path.addLine(to: to)
    }
}
