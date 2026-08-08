import AppKit
import SwiftUI

final class TasksMacApplicationDelegate: NSObject, NSApplicationDelegate {
    func application(
        _ application: NSApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        TaskNativeNotificationCoordinator.shared
            .didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }

    func application(
        _ application: NSApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        TaskNativeNotificationCoordinator.shared
            .didFailToRegisterForRemoteNotifications()
    }
}

@main
struct TasksMacApp: App {
    @NSApplicationDelegateAdaptor(TasksMacApplicationDelegate.self)
    private var applicationDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var browserModel = TasksBrowserModel()
    @StateObject private var keyboardController = TasksMacKeyboardController()

    var body: some Scene {
        Window("Tasks", id: "main") {
            TasksMacWebView(model: browserModel)
                .background(Color(nsColor: TasksMacAppearance.applicationBackground))
                .frame(
                    minWidth: TasksMacWindowPolicy.minimumSize.width,
                    minHeight: TasksMacWindowPolicy.minimumSize.height
                )
                .background(TasksMacWindowConfigurator())
                .onOpenURL(perform: handleURL)
                .onAppear {
                    keyboardController.attach(to: browserModel)
                }
                .onChange(of: scenePhase) { _, newPhase in
                    if newPhase == .active {
                        browserModel.notifyNativeAppBecameActive()
                    }
                }
        }
        .defaultSize(width: 1_100, height: 780)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(replacing: .appSettings) {
                Button("Settings...") {
                    browserModel.open(TaskNativeRoute.settings)
                }
                .keyboardShortcut(",", modifiers: .command)
            }
            CommandMenu("Navigate") {
                navigationButton("Today", route: .today, key: "1")
                navigationButton("Upcoming", route: .upcoming, key: "2")
                navigationButton("Anytime", route: .anytime, key: "3")
                navigationButton("Someday", route: .someday, key: "4")
                navigationButton("Done", route: .done, key: "5")
                navigationButton("Settings", route: .settings, key: "6")
            }
        }
    }

    private func navigationButton(
        _ title: String,
        route: TasksMacDestination,
        key: KeyEquivalent
    ) -> some View {
        Button(title) {
            browserModel.open(route.nativeRoute)
        }
        .keyboardShortcut(key, modifiers: .command)
    }

    private func handleURL(_ url: URL) {
        switch TaskCompanionURLAction.resolve(url) {
        case .task(let route):
            browserModel.open(route)
        case .external(let destination):
            NSWorkspace.shared.open(destination)
        case .ignore:
            break
        }
    }
}

enum TasksMacWindowPolicy {
    static let minimumSize = NSSize(width: 360, height: 420)

    static func apply(to window: NSWindow) {
        window.styleMask.insert(.resizable)
        window.collectionBehavior.remove(.fullScreenNone)
        window.collectionBehavior.remove(.fullScreenDisallowsTiling)
        window.collectionBehavior.formUnion([
            .fullScreenPrimary,
            .fullScreenAllowsTiling,
        ])
        window.minSize = minimumSize
    }
}

private struct TasksMacWindowConfigurator: NSViewRepresentable {
    func makeCoordinator() -> TasksMacWindowPolicyObserver {
        TasksMacWindowPolicyObserver()
    }

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        let coordinator = context.coordinator
        DispatchQueue.main.async {
            coordinator.attach(to: view.window)
        }
        return view
    }

    func updateNSView(_ view: NSView, context: Context) {
        let coordinator = context.coordinator
        DispatchQueue.main.async {
            coordinator.attach(to: view.window)
        }
    }

    static func dismantleNSView(
        _ view: NSView,
        coordinator: TasksMacWindowPolicyObserver
    ) {
        coordinator.stopObserving()
    }
}

final class TasksMacWindowPolicyObserver {
    private weak var window: NSWindow?
    private var notificationTokens: [NSObjectProtocol] = []

    private let observedNotifications: [Notification.Name] = [
        NSWindow.didBecomeMainNotification,
        NSWindow.didEnterFullScreenNotification,
        NSWindow.didExitFullScreenNotification,
        NSWindow.didChangeScreenNotification,
    ]

    func attach(to window: NSWindow?) {
        guard let window else {
            return
        }

        if self.window !== window {
            stopObserving()
            self.window = window
            notificationTokens = observedNotifications.map { name in
                NotificationCenter.default.addObserver(
                    forName: name,
                    object: window,
                    queue: .main
                ) { notification in
                    guard let window = notification.object as? NSWindow else {
                        return
                    }
                    TasksMacWindowPolicy.apply(to: window)
                }
            }
        }

        TasksMacWindowPolicy.apply(to: window)
    }

    func stopObserving() {
        for token in notificationTokens {
            NotificationCenter.default.removeObserver(token)
        }
        notificationTokens.removeAll()
        window = nil
    }

    deinit {
        stopObserving()
    }
}

enum TasksMacDestination: Int, CaseIterable, Equatable {
    case today = 1
    case upcoming = 2
    case anytime = 3
    case someday = 4
    case done = 5
    case settings = 6

    var nativeRoute: TaskNativeRoute {
        switch self {
        case .today:
            return .list(.today)
        case .upcoming:
            return .list(.upcoming)
        case .anytime:
            return .list(.anytime)
        case .someday:
            return .list(.someday)
        case .done:
            return .list(.done)
        case .settings:
            return .settings
        }
    }
}
