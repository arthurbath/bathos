import AppIntents
import OSLog
import SwiftUI
import UserNotifications
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
        if #available(iOS 26.0, macOS 26.0, *) {
            await TaskListWidgetPushRegistrationCoordinator.reconcileCurrentToken()
        }
        guard let credentialStore = TaskWidgetCredentialStore(),
              let snapshotStore = TaskWidgetStore() else {
            return entry(for: configuration)
        }
        let snapshot = await TaskWidgetBackgroundRefresher(
            credentialStore: credentialStore,
            snapshotStore: snapshotStore,
            client: TaskWidgetSnapshotClient()
        ).refresh()
        if let snapshot {
            TaskWidgetBadgeSynchronizer.synchronize(snapshot)
        }
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

private enum TaskWidgetBadgeSynchronizer {
    static func synchronize(_ snapshot: TaskWidgetSnapshot) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            let count = TaskNativeBadgePolicy.count(
                from: snapshot,
                notificationsEnabled: notificationsEnabled(settings.authorizationStatus),
                badgesEnabled: settings.badgeSetting == .enabled
            )
            center.setBadgeCount(count, withCompletionHandler: nil)
        }
    }

    private static func notificationsEnabled(_ status: UNAuthorizationStatus) -> Bool {
        switch status {
        case .authorized, .provisional:
            return true
#if os(iOS)
        case .ephemeral:
            return true
#endif
        case .notDetermined, .denied:
            return false
        @unknown default:
            return false
        }
    }
}

struct TaskListWidget: Widget {
    var body: some WidgetConfiguration {
        taskListWidgetConfiguration().pushHandler(TaskListWidgetPushHandler.self)
    }
}

private func taskListWidgetConfiguration() -> some WidgetConfiguration {
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

@available(iOS 26.0, macOS 26.0, *)
struct TaskListWidgetPushHandler: WidgetPushHandler {
    init() {}

    func pushTokenDidChange(_ pushInfo: WidgetPushInfo, widgets: [WidgetInfo]) {
        TaskListWidgetPushRegistrationCoordinator.persist(
            pushInfo,
            widgets: widgets
        )
    }
}

@available(iOS 26.0, macOS 26.0, *)
private enum TaskListWidgetPushRegistrationCoordinator {
    static func reconcileCurrentToken() async {
        guard let pushInfo = await WidgetCenter.shared.currentPushInfo else {
            taskWidgetLogger.notice("WidgetKit has not supplied current push information")
            return
        }

        do {
            let widgets = try await WidgetCenter.shared.currentConfigurations()
            persist(pushInfo, widgets: widgets)
        } catch {
            taskWidgetLogger.error(
                "Could not read current widget configurations: \(error.localizedDescription, privacy: .public)"
            )
        }
    }

    static func persist(_ pushInfo: WidgetPushInfo, widgets: [WidgetInfo]) {
#if os(macOS)
        let platform = "macos"
#else
        let platform = "ios"
#endif
        let enabled = widgets.contains { $0.kind == TaskCompanionConstants.widgetKind }
        let registration = TaskWidgetPushRegistration(
            schemaVersion: TaskWidgetPushRegistration.schemaVersion,
            deviceToken: pushInfo.token.map { String(format: "%02x", $0) }.joined(),
            platform: platform,
            environment: Bundle.main.object(
                forInfoDictionaryKey: "TasksWidgetAPNSEnvironment"
            ) as? String ?? "development",
            topic: "garden.bath.tasks.push-type.widgets",
            enabled: enabled
        )
        guard let registrationStore = TaskWidgetPushRegistrationStore() else {
            taskWidgetLogger.error("Could not open the widget push registration store")
            return
        }

        do {
            try registrationStore.storePending(registration)
            taskWidgetLogger.notice(
                "Stored a \(platform, privacy: .public) widget push registration; enabled=\(enabled, privacy: .public)"
            )
            Task { await TaskWidgetPushRegistrationSynchronizer()?.synchronize() }
        } catch {
            taskWidgetLogger.error(
                "Could not persist widget push registration: \(error.localizedDescription, privacy: .public)"
            )
        }
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
                                TaskWidgetLucideIconView(icon: .openTask)
                                    .frame(width: 10, height: 10)
                                Text(task.summary)
                                    .font(.system(
                                        size: TaskWidgetPresentationPolicy
                                            .lockScreenTaskFontSize,
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
            TaskWidgetLucideIconView(
                icon: entry.snapshot == nil ? .task : .emptyState
            )
            .frame(width: 11, height: 11)
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
    @Environment(\.widgetFamily) private var family

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
                    TaskWidgetLucideIconView(icon: entry.listID.lucideIcon)
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
                TaskWidgetLucideIconView(icon: .addTask)
                    .frame(width: 15, height: 15)
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
                    ForEach(list.tasks.prefix(TaskWidgetPresentationPolicy.taskLimit(for: family))) { task in
                        HStack(spacing: 0) {
                            HStack(spacing: 2) {
                                leadingControl(for: task)
                                TaskWidgetListContext(
                                    listID: entry.listID,
                                    task: task,
                                    planningDate: entry.snapshot?.planningDate
                                )
                            }
                            .padding(.trailing, 9)
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
                            Spacer(minLength: 2)
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
            emptyState("Open Tasks")
        }
    }

    @ViewBuilder
    private func leadingControl(for task: TaskWidgetTask) -> some View {
        if task.isRecurrenceProjection == true && entry.listID == .upcoming {
            TaskWidgetLucideIconView(icon: .recurrence)
                .foregroundStyle(.secondary)
                .frame(width: 14, height: 14)
                .frame(width: 28, height: 28)
                .accessibilityLabel("Repeating Schedule")
        } else if task.terminalState == nil {
            Toggle(
                isOn: false,
                intent: CompleteTaskIntent(taskID: task.id.uuidString.lowercased())
            ) {
                EmptyView()
            }
            .toggleStyle(TaskWidgetCompletionToggleStyle(
                someday: entry.listID == .someday
            ))
            .accessibilityLabel("Complete \(task.summary)")
        } else {
            TaskWidgetLucideIconView(icon: taskIcon(task))
                .foregroundStyle(taskColor(task))
                .frame(width: 14, height: 14)
                .frame(width: 28, height: 28)
        }
    }

    private func primaryLinkLabel(_ primaryLink: TaskWidgetPrimaryLink) -> some View {
        TaskWidgetLucideIconView(icon: primaryLinkIcon(primaryLink))
        .frame(width: 15, height: 15)
        .foregroundStyle(.blue)
        .frame(width: 28, height: 28)
        .contentShape(Rectangle())
    }

    private func primaryLinkIcon(
        _ primaryLink: TaskWidgetPrimaryLink
    ) -> TaskWidgetLucideIcon {
        switch primaryLink.iconKind {
        case .mail:
            return .mailLink
        case .jira:
            return .jiraLink
        case .obsidian:
            return .obsidianLink
        case .link:
            return .primaryLink
        }
    }

    private func emptyState(_ message: String) -> some View {
        VStack(spacing: 8) {
            TaskWidgetLucideIconView(
                icon: entry.snapshot == nil ? .task : .emptyState
            )
                .frame(width: 22, height: 22)
                .foregroundStyle(.secondary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(
            maxWidth: .infinity,
            maxHeight: .infinity,
            alignment: .center
        )
    }

    private func taskIcon(_ task: TaskWidgetTask) -> TaskWidgetLucideIcon {
        if task.terminalState == "deleted" {
            return .deletedTask
        }
        if task.terminalState != nil {
            return .completedTask
        }
        return entry.listID == .someday ? .somedayTask : .openTask
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
        TaskWidgetLucideIconView(icon: icon)
        .foregroundStyle(color)
        .frame(width: 15, height: 15)
        .accessibilityLabel(accessibilityLabel)
    }

    private var icon: TaskWidgetLucideIcon {
        switch horizon {
        case "inbox":
            return .inbox
        case "now":
            return .now
        case "later":
            return .later
        default:
            return .next
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
            TaskWidgetLucideIconView(
                icon: configuration.isOn
                    ? .completedTask
                    : someday ? .somedayTask : .openTask
            )
            .foregroundStyle(configuration.isOn ? Color.green : Color.secondary)
            .frame(width: 14, height: 14)
            .frame(width: 28, height: 28)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private extension TaskWidgetListID {
    var lucideIcon: TaskWidgetLucideIcon {
        switch self {
        case .today: .today
        case .upcoming: .upcoming
        case .anytime: .anytime
        case .someday: .someday
        case .done: .done
        }
    }
}
