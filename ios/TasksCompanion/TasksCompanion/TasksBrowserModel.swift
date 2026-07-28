import Foundation
import OSLog
import WebKit
import WidgetKit

@MainActor
final class TasksBrowserModel: NSObject, ObservableObject {
    private static let logger = Logger(
        subsystem: "garden.bath.tasks",
        category: "WidgetBridge"
    )

    @Published private(set) var requestedURL = TaskNativeRoute.list(.today).webURL
    @Published private(set) var isLoading = true
    @Published private(set) var hasLoadedContent = false
    @Published private(set) var loadError: String?

    weak var webView: WKWebView?

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
        let nextURL = route.webURL
        requestedURL = nextURL
        loadError = nil
        isLoading = true
        webView?.load(URLRequest(url: nextURL))
    }

    func retry() {
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
        isLoading = false
        hasLoadedContent = true
        loadError = nil
    }

    func didFailLoading(_ error: Error) {
        isLoading = false
        hasLoadedContent = false
        loadError = error.localizedDescription
    }

    func didTerminateWebContent() {
        hasLoadedContent = false
        loadError = nil
        isLoading = true
        webView?.load(URLRequest(url: requestedURL))
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
            } else if envelope.type == "snapshot" {
                changed = try store.accept(data)
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
}

private struct TaskBridgeEnvelope: Decodable {
    let type: String
    let schemaVersion: Int
}
