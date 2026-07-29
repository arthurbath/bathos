import Foundation
import OSLog
import WebKit
import WidgetKit

@MainActor
final class TasksBrowserModel: NSObject, ObservableObject {
    typealias InPageNavigator = (WKWebView, URL) -> Void

    private static let logger = Logger(
        subsystem: "garden.bath.tasks",
        category: "WidgetBridge"
    )

    @Published private(set) var requestedURL = TaskNativeRoute.list(.today).webURL
    @Published private(set) var isLoading = true
    @Published private(set) var hasLoadedContent = false
    @Published private(set) var loadError: String?

    weak var webView: WKWebView?

    private let coldStartRecoveryDelayNanoseconds: UInt64
    private let inPageNavigator: InPageNavigator
    private var coldStartRecoveryTask: Task<Void, Never>?
    private var isPerformingColdStartRecovery = false

    init(
        coldStartRecoveryDelayNanoseconds: UInt64 = 400_000_000,
        inPageNavigator: @escaping InPageNavigator = TasksBrowserModel.navigateInPage
    ) {
        self.coldStartRecoveryDelayNanoseconds = coldStartRecoveryDelayNanoseconds
        self.inPageNavigator = inPageNavigator
    }

    private static func recordBridgeDiagnostic(_ message: String) {
        logger.notice("\(message, privacy: .public)")
    }

    func attach(_ webView: WKWebView) {
        self.webView = webView
        if webView.url == nil {
            hasLoadedContent = false
            webView.load(URLRequest(url: requestedURL))
        }
    }

    func open(_ route: TaskNativeRoute) {
        cancelColdStartRecovery()
        let nextURL = route.webURL
        requestedURL = nextURL
        loadError = nil
        if hasLoadedContent, let webView {
            isLoading = false
            inPageNavigator(webView, nextURL)
            return
        }
        isLoading = true
        webView?.load(URLRequest(url: nextURL))
    }

    func retry() {
        cancelColdStartRecovery()
        loadError = nil
        isLoading = true
        if let webView, webView.url != nil {
            webView.reload()
        } else {
            webView?.load(URLRequest(url: requestedURL))
        }
    }

    func didStartLoading() {
        isLoading = true
        loadError = nil
    }

    func didFinishLoading() {
        cancelColdStartRecovery()
        isLoading = false
        hasLoadedContent = true
        loadError = nil
    }

    func didFailLoading(_ error: Error) {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain,
           nsError.code == NSURLErrorCancelled {
            return
        }
        guard !hasLoadedContent else {
            return
        }
        if coldStartRecoveryTask != nil {
            return
        }
        if !isPerformingColdStartRecovery {
            isLoading = true
            loadError = nil
            coldStartRecoveryTask = Task { @MainActor [weak self] in
                guard let self else {
                    return
                }
                try? await Task.sleep(
                    nanoseconds: self.coldStartRecoveryDelayNanoseconds
                )
                guard !Task.isCancelled else {
                    return
                }
                self.performColdStartRecovery()
            }
            return
        }

        isPerformingColdStartRecovery = false
        isLoading = false
        hasLoadedContent = false
        loadError = error.localizedDescription
    }

    func didTerminateWebContent() {
        cancelColdStartRecovery()
        hasLoadedContent = false
        loadError = nil
        isLoading = true
        webView?.load(URLRequest(url: requestedURL))
    }

    func performColdStartRecovery() {
        coldStartRecoveryTask?.cancel()
        coldStartRecoveryTask = nil
        isPerformingColdStartRecovery = true
        webView?.load(URLRequest(url: requestedURL))
    }

    private func cancelColdStartRecovery() {
        coldStartRecoveryTask?.cancel()
        coldStartRecoveryTask = nil
        isPerformingColdStartRecovery = false
    }

    static func navigateInPage(_ webView: WKWebView, to url: URL) {
        var components = URLComponents()
        components.path = url.path
        components.query = url.query
        let destination = components.string ?? url.path
        guard let encoded = try? JSONEncoder().encode(destination),
        let literal = String(data: encoded, encoding: .utf8) else {
            return
        }
        webView.evaluateJavaScript("""
        window.history.pushState({}, "", \(literal));
        window.dispatchEvent(new PopStateEvent("popstate"));
        """)
    }

    func acceptBridgeMessage(_ message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame else {
            Self.recordBridgeDiagnostic("Rejected: non-main frame")
            return
        }
        guard let sourceURL = message.frameInfo.request.url,
              sourceURL.scheme?.lowercased() == "https",
              sourceURL.host?.lowercased() == TaskCompanionConstants.trustedWebHost,
              sourceURL.path.hasPrefix("/tasks") else {
            Self.recordBridgeDiagnostic("Rejected: untrusted route")
            return
        }
        guard JSONSerialization.isValidJSONObject(message.body),
              let data = try? JSONSerialization.data(withJSONObject: message.body) else {
            Self.recordBridgeDiagnostic("Rejected: non-JSON body")
            return
        }
        guard data.count <= TaskWidgetSnapshot.maximumEncodedBytes else {
            Self.recordBridgeDiagnostic("Rejected: oversized body (\(data.count) bytes)")
            return
        }
        guard let envelope = try? JSONDecoder().decode(TaskBridgeEnvelope.self, from: data),
              envelope.schemaVersion == TaskWidgetSnapshot.schemaVersion else {
            Self.recordBridgeDiagnostic("Rejected: invalid envelope")
            return
        }
        guard let store = TaskWidgetStore() else {
            Self.recordBridgeDiagnostic("Rejected: App Group store unavailable")
            return
        }

        do {
            let changed: Bool
            if envelope.type == "clear" {
                changed = try store.clear()
                if let credentialStore = TaskWidgetCredentialStore() {
                    let credential = try? credentialStore.load()
                    try? credentialStore.clear()
                    if let credential {
                        Task {
                            await Self.revokeCredential(credential.credential)
                        }
                    }
                }
            } else if envelope.type == "snapshot" {
                changed = try store.accept(data)
            } else if envelope.type == "credential" {
                let message = try JSONDecoder().decode(TaskCredentialBridgeMessage.self, from: data)
                let credential = TaskWidgetCredential(
                    schemaVersion: TaskWidgetCredential.schemaVersion,
                    ownerId: message.ownerId,
                    installationId: message.installationId,
                    credential: message.credential,
                    expiresAt: message.expiresAt
                )
                guard let credentialStore = TaskWidgetCredentialStore() else {
                    Self.recordBridgeDiagnostic("Rejected: credential store unavailable")
                    return
                }
                guard let installationID = try TaskWidgetInstallationStore()?.identifier(),
                      installationID == credential.installationId else {
                    Self.recordBridgeDiagnostic("Rejected: installation mismatch")
                    return
                }
                try credentialStore.store(credential)
                changed = false
            } else {
                Self.recordBridgeDiagnostic("Rejected: unsupported message type")
                return
            }
            if changed {
                WidgetCenter.shared.reloadTimelines(ofKind: TaskCompanionConstants.widgetKind)
            }
            Self.recordBridgeDiagnostic(
                "Accepted: \(envelope.type); changed=\(changed)"
            )
        } catch {
            Self.recordBridgeDiagnostic(
                "Rejected: \(envelope.type) validation or persistence (\(String(describing: error)))"
            )
            return
        }
    }

    private static func revokeCredential(_ credential: String) async {
        var request = URLRequest(url: TaskCompanionConstants.widgetActionsURL)
        request.httpMethod = "POST"
        request.timeoutInterval = 5
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Widget \(credential)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "action": "revoke",
        ])
        _ = try? await URLSession.shared.data(for: request)
    }
}

private struct TaskBridgeEnvelope: Decodable {
    let type: String
    let schemaVersion: Int
}

private struct TaskCredentialBridgeMessage: Decodable {
    let ownerId: UUID
    let installationId: UUID
    let credential: String
    let expiresAt: String
}
