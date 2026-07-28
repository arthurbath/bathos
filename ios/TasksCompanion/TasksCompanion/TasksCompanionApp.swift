import SwiftUI
import UIKit

@main
struct TasksCompanionApp: App {
    @StateObject private var browserModel = TasksBrowserModel()

    var body: some Scene {
        WindowGroup {
            TasksWebView(model: browserModel)
                .ignoresSafeArea(.container, edges: .bottom)
                .onOpenURL { url in
                    switch TaskCompanionURLAction.resolve(url) {
                    case .task(let route):
                        browserModel.open(route)
                    case .external(let destination):
                        UIApplication.shared.open(destination)
                    case .ignore:
                        break
                    }
                }
        }
    }
}
