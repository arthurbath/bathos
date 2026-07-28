import SwiftUI

@main
struct TasksCompanionApp: App {
    @StateObject private var browserModel = TasksBrowserModel()

    var body: some Scene {
        WindowGroup {
            TasksWebView(model: browserModel)
                .ignoresSafeArea(.container, edges: .bottom)
                .onOpenURL { url in
                    browserModel.open(TaskNativeRoute.parse(url))
                }
        }
    }
}
