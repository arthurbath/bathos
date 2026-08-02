import SwiftUI
import WatchConnectivity
import WidgetKit

@main
struct TasksWatchApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = TasksWatchModel()

    var body: some Scene {
        WindowGroup {
            TasksWatchCaptureView(model: model)
                .onAppear { model.activate() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.refreshProgress() }
                }
        }
    }
}

struct TasksWatchCaptureView: View {
    @ObservedObject var model: TasksWatchModel

    var body: some View {
        VStack(spacing: 10) {
            TextFieldLink(prompt: Text("Task Summary")) {
                Label("Add Task", systemImage: "plus")
                    .font(.headline)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } onSubmit: { summary in
                model.submit(summary)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(model.isSubmitting)

            if let status = model.status {
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
    }
}

@MainActor
final class TasksWatchModel: NSObject, ObservableObject, WCSessionDelegate {
    @Published var isSubmitting = false
    @Published var status: String?

    private let session = WCSession.isSupported() ? WCSession.default : nil
    private let client = TaskWatchActionsClient()

    override init() {
        super.init()
        session?.delegate = self
    }

    func activate() {
        session?.activate()
        apply(session?.receivedApplicationContext ?? [:])
        refreshProgress()
    }

    func submit(_ value: String) {
        let summary = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !summary.isEmpty, !isSubmitting else { return }
        guard let credential = try? TaskWatchCredentialStore()?.load() else {
            status = "Open Tasks on iPhone"
            return
        }
        isSubmitting = true
        status = nil
        Task {
            do {
                try await client.createInboxTask(summary: summary, credential: credential)
                status = "Added to Inbox"
                await updateProgress(using: credential)
            } catch {
                status = "Task Could Not Be Added"
            }
            isSubmitting = false
        }
    }

    func refreshProgress() {
        guard let credential = try? TaskWatchCredentialStore()?.load() else { return }
        Task { await updateProgress(using: credential) }
    }

    private func updateProgress(using credential: TaskWatchCredential) async {
        guard let progress = try? await client.fetchProgress(credential: credential),
              let store = TaskWatchProgressStore() else { return }
        try? store.store(progress)
        WidgetCenter.shared.reloadTimelines(
            ofKind: TaskCompanionConstants.watchComplicationKind
        )
    }

    private func apply(_ context: [String: Any]) {
        guard context["schemaVersion"] as? Int == 1 else { return }
        if context["clear"] as? Bool == true {
            try? TaskWatchCredentialStore()?.clear()
            try? TaskWatchProgressStore()?.clear()
            WidgetCenter.shared.reloadTimelines(
                ofKind: TaskCompanionConstants.watchComplicationKind
            )
            return
        }
        guard let data = context["credential"] as? Data,
              let value = try? JSONDecoder().decode(TaskWatchCredential.self, from: data) else {
            return
        }
        try? TaskWatchCredentialStore()?.store(value)
    }

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let context = session.receivedApplicationContext
        Task { @MainActor in
            self.apply(context)
            self.refreshProgress()
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        Task { @MainActor in
            self.apply(applicationContext)
            self.refreshProgress()
        }
    }
}
