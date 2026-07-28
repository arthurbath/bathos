import Foundation

enum TaskCompanionConstants {
    static let appGroupIdentifier = "group.garden.bath.tasks"
    static let widgetKind = "garden.bath.tasks.list-widget"
    static let webBridgeHandler = "bathosTasksWidget"
    static let trustedWebHost = "os.bath.garden"
    static let widgetActionsURL = URL(
        string: "https://rsqfokyqntmtdejfwmjs.supabase.co/functions/v1/tasks-widget-actions"
    )!
}
