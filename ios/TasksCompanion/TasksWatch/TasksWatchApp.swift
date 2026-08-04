import SwiftUI
import WatchConnectivity
import WatchKit
import WidgetKit

@main
struct TasksWatchApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = TasksWatchModel()

    var body: some Scene {
        WindowGroup {
            TasksWatchCaptureView(model: model)
                .onAppear { model.activate() }
                .onOpenURL { url in
                    guard TaskWatchCaptureLaunchPolicy.shouldBeginCapture(
                        for: url
                    ) else { return }
                    model.beginComplicationCapture()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.refreshProgress() }
                }
        }
    }
}

struct TasksWatchCaptureView: View {
    @ObservedObject var model: TasksWatchModel

    var body: some View {
        ZStack {
            TextFieldLink(prompt: Text("Task Summary")) {
                Image(systemName: "plus")
                    .font(.system(size: 26, weight: .medium))
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(Circle().fill(.green))
                    .contentShape(Circle())
            } onSubmit: { summary in
                model.submit(summary)
            }
            .buttonStyle(.plain)
            .disabled(model.isSubmitting)
            .accessibilityLabel("Add Task")

            if let status = model.status {
                VStack {
                    Spacer()
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .transition(.opacity)
                }
                .allowsHitTesting(false)
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
    private var pendingCapture: PendingWatchCapture?
    private var authorityRequestID: UUID?
    private var authorityTimeoutTask: Task<Void, Never>?
    private var statusDismissTask: Task<Void, Never>?
    private var capturePresentationTask: Task<Void, Never>?
    private var captureInputIsPresented = false

    override init() {
        super.init()
        session?.delegate = self
    }

    func activate() {
        session?.activate()
        apply(session?.receivedApplicationContext ?? [:])
        refreshProgress()
    }

    func beginComplicationCapture() {
        guard !isSubmitting,
              !captureInputIsPresented,
              capturePresentationTask == nil else { return }
        capturePresentationTask = Task { [weak self] in
            guard let self else { return }
            for attempt in 0..<10 {
                guard !Task.isCancelled else { return }
                if presentComplicationCaptureInput() {
                    return
                }
                if attempt < 9 {
                    try? await Task.sleep(for: .milliseconds(100))
                }
            }
            capturePresentationTask = nil
        }
    }

    private func presentComplicationCaptureInput() -> Bool {
        guard !captureInputIsPresented,
              let controller = WKApplication.shared().visibleInterfaceController
                ?? WKApplication.shared().rootInterfaceController else {
            return false
        }
        captureInputIsPresented = true
        controller.presentTextInputController(
            withSuggestions: nil,
            allowedInputMode: .plain
        ) { [weak self] results in
            Task { @MainActor in
                guard let self else { return }
                self.captureInputIsPresented = false
                self.capturePresentationTask = nil
                guard let summary = results?.first as? String else { return }
                self.submit(summary)
            }
        }
        return true
    }

    func submit(_ value: String) {
        let summary = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !summary.isEmpty, !isSubmitting else { return }
        let capture = PendingWatchCapture(summary: summary)
        pendingCapture = capture
        isSubmitting = true
        clearStatus()
        guard let credential = try? TaskWatchCredentialStore()?.load() else {
            showStatus("Connecting to Tasks")
            requestAuthority()
            return
        }
        perform(capture, using: credential)
    }

    private func perform(
        _ capture: PendingWatchCapture,
        using credential: TaskWatchCredential
    ) {
        pendingCapture = nil
        Task {
            do {
                try await client.createInboxTask(
                    summary: capture.summary,
                    credential: credential,
                    clientMutationId: capture.clientMutationID,
                    operationId: capture.operationID
                )
                showStatus("Added to Inbox", dismissAfter: 2)
                await updateProgress(using: credential)
                isSubmitting = false
            } catch TaskWatchError.invalidCredential {
                try? TaskWatchCredentialStore()?.clear()
                pendingCapture = capture
                showStatus("Connecting to Tasks")
                requestAuthority()
            } catch {
                showStatus("Task Could Not Be Added")
                isSubmitting = false
            }
        }
    }

    func refreshProgress() {
        guard let credential = try? TaskWatchCredentialStore()?.load() else {
            requestAuthority()
            return
        }
        Task { await updateProgress(using: credential) }
    }

    private func requestAuthority() {
        guard authorityRequestID == nil else { return }
        guard let session, session.activationState == .activated else {
            session?.activate()
            return
        }

        let requestID = UUID()
        authorityRequestID = requestID
        let request = TaskWatchConnectivityMessage.credentialRequest(
            identifier: requestID
        )
        if session.isReachable {
            session.sendMessage(request) { [weak self] reply in
                Task { @MainActor in self?.apply(reply) }
            } errorHandler: { _ in }
        }
        session.transferUserInfo(request)

        authorityTimeoutTask?.cancel()
        authorityTimeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 8_000_000_000)
            guard !Task.isCancelled else { return }
            self?.authorityRequestDidTimeOut(requestID)
        }
    }

    private func authorityRequestDidTimeOut(_ requestID: UUID) {
        guard authorityRequestID == requestID else { return }
        authorityRequestID = nil
        authorityTimeoutTask = nil
        if pendingCapture != nil {
            pendingCapture = nil
            isSubmitting = false
            showStatus("Could Not Connect to Tasks")
        }
    }

    private func clearStatus() {
        statusDismissTask?.cancel()
        statusDismissTask = nil
        withAnimation { status = nil }
    }

    private func showStatus(_ value: String, dismissAfter seconds: UInt64? = nil) {
        statusDismissTask?.cancel()
        withAnimation { status = value }
        guard let seconds else {
            statusDismissTask = nil
            return
        }
        statusDismissTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            self?.clearStatus()
        }
    }

    private func updateProgress(using credential: TaskWatchCredential) async {
        do {
            let progress = try await client.fetchProgress(credential: credential)
            guard let store = TaskWatchProgressStore() else { return }
            try store.store(progress)
            WidgetCenter.shared.reloadTimelines(
                ofKind: TaskCompanionConstants.watchComplicationKind
            )
        } catch TaskWatchError.invalidCredential {
            try? TaskWatchCredentialStore()?.clear()
            requestAuthority()
        } catch {
            return
        }
    }

    private func apply(_ context: [String: Any]) {
        guard context["schemaVersion"] as? Int
                == TaskWatchConnectivityMessage.schemaVersion else { return }
        if context["clear"] as? Bool == true {
            try? TaskWatchCredentialStore()?.clear()
            try? TaskWatchProgressStore()?.clear()
            WidgetCenter.shared.reloadTimelines(
                ofKind: TaskCompanionConstants.watchComplicationKind
            )
            return
        }
        guard let value = TaskWatchConnectivityMessage.credential(from: context) else { return }
        try? TaskWatchCredentialStore()?.store(value)
        authorityRequestID = nil
        authorityTimeoutTask?.cancel()
        authorityTimeoutTask = nil
        if let capture = pendingCapture {
            perform(capture, using: value)
        } else {
            refreshProgress()
        }
    }

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let context = session.receivedApplicationContext
        Task { @MainActor in
            self.apply(context)
            if (try? TaskWatchCredentialStore()?.load()) == nil {
                self.requestAuthority()
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        Task { @MainActor in
            self.apply(applicationContext)
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveUserInfo userInfo: [String: Any]
    ) {
        Task { @MainActor in
            self.apply(userInfo)
        }
    }
}

private struct PendingWatchCapture {
    let summary: String
    let clientMutationID = UUID()
    let operationID = UUID()
}
