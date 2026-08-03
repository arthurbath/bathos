import SwiftUI
import UIKit

final class TasksCompanionApplicationDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [
            UIApplication.LaunchOptionsKey: Any
        ]? = nil
    ) -> Bool {
        TaskWatchConnectivityCoordinator.shared.activate()
        return true
    }
}

@main
struct TasksCompanionApp: App {
    @UIApplicationDelegateAdaptor(TasksCompanionApplicationDelegate.self)
    private var applicationDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var browserModel = TasksBrowserModel()

    var body: some Scene {
        WindowGroup {
            TasksWebView(model: browserModel)
                .background(Color(uiColor: TasksCompanionAppearance.applicationBackground))
                .ignoresSafeArea(.container, edges: .bottom)
                .onOpenURL(perform: handleURL)
                .onAppear {
                    consumeNewTaskControlRequest()
                }
                .onChange(of: scenePhase) { _, newPhase in
                    if newPhase == .active {
                        consumeNewTaskControlRequest()
                    }
                }
        }
    }

    private func handleURL(_ url: URL) {
        switch TaskCompanionURLAction.resolve(url) {
        case .task(let route):
            browserModel.open(route)
        case .external(let destination):
            UIApplication.shared.open(destination)
        case .ignore:
            break
        }
    }

    private func consumeNewTaskControlRequest() {
        guard let store = NewTaskControlRequestStore(),
              (try? store.consume()) == true else {
            return
        }
        browserModel.open(.newTask)
    }
}
