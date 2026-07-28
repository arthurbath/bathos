import Foundation
import WebKit
import WidgetKit

@MainActor
final class TasksBrowserModel: NSObject, ObservableObject {
    @Published private(set) var requestedURL = TaskNativeRoute.list(.today).webURL
    @Published private(set) var isLoading = true
    @Published private(set) var hasLoadedContent = false
    @Published private(set) var loadError: String?

    weak var webView: WKWebView?

    func attach(_ webView: WKWebView) {
        self.webView = webView
        if webView.url == nil {
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
        guard !hasLoadedContent else {
            return
        }
        loadError = error.localizedDescription
    }

    func acceptBridgeMessage(_ message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let sourceURL = message.frameInfo.request.url,
              sourceURL.scheme?.lowercased() == "https",
              sourceURL.host?.lowercased() == TaskCompanionConstants.trustedWebHost,
              sourceURL.path.hasPrefix("/tasks") else {
            return
        }
        guard JSONSerialization.isValidJSONObject(message.body),
              let data = try? JSONSerialization.data(withJSONObject: message.body),
              data.count <= TaskWidgetSnapshot.maximumEncodedBytes,
              let envelope = try? JSONDecoder().decode(TaskBridgeEnvelope.self, from: data),
              envelope.schemaVersion == TaskWidgetSnapshot.schemaVersion,
              let store = TaskWidgetStore() else {
            return
        }

        do {
            let changed: Bool
            if envelope.type == "clear" {
                changed = try store.clear()
            } else if envelope.type == "snapshot" {
                changed = try store.accept(data)
            } else {
                return
            }
            if changed {
                WidgetCenter.shared.reloadTimelines(ofKind: TaskCompanionConstants.widgetKind)
            }
        } catch {
            return
        }
    }
}

private struct TaskBridgeEnvelope: Decodable {
    let type: String
    let schemaVersion: Int
}
