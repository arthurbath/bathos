import AppKit
import SwiftUI

@main
struct TasksMacApp: App {
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
        }
        .defaultSize(width: 1_100, height: 780)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .newItem) {}
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
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.minSize = minimumSize
    }
}

private struct TasksMacWindowConfigurator: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            configure(view)
        }
        return view
    }

    func updateNSView(_ view: NSView, context: Context) {
        DispatchQueue.main.async {
            configure(view)
        }
    }

    private func configure(_ view: NSView) {
        guard let window = view.window else {
            return
        }
        TasksMacWindowPolicy.apply(to: window)
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
