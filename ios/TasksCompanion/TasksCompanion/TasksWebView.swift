import SwiftUI
import UIKit
import WebKit

enum TasksWebViewPolicy {
    static func apply(to configuration: WKWebViewConfiguration) {
        configuration.websiteDataStore = .default()
        configuration.limitsNavigationsToAppBoundDomains = true
    }
}

enum TasksWebNavigationDisposition: Equatable {
    case allow
    case openExternally
    case cancel
}

enum TasksWebNavigationPolicy {
    private static let internalPlatformPaths: Set<String> = [
        "/account",
        "/signin",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/terms",
        "/help",
        "/.lovable/oauth/consent",
    ]

    static func disposition(for url: URL) -> TasksWebNavigationDisposition {
        let scheme = url.scheme?.lowercased()
        if scheme == "about" {
            return .allow
        }
        guard scheme == "https",
              url.host?.lowercased() == TaskCompanionConstants.trustedWebHost else {
            return .openExternally
        }

        let path = url.path
        if path == "/tasks"
            || path.hasPrefix("/tasks/")
            || internalPlatformPaths.contains(path) {
            return .allow
        }

        return .openExternally
    }
}

struct TasksWebView: View {
    @ObservedObject var model: TasksBrowserModel

    var body: some View {
        ZStack {
            TasksWebViewRepresentable(model: model)
                .background(Color.black)

            if model.isLoading && !model.hasLoadedContent {
                ProgressView()
                    .tint(.white)
                    .accessibilityLabel("Loading Tasks")
            }

            if let loadError = model.loadError, !model.hasLoadedContent {
                VStack(spacing: 16) {
                    Image(systemName: "wifi.slash")
                        .font(.title)
                    Text("Tasks Unavailable")
                        .font(.headline)
                    Text(loadError)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        model.retry()
                    }
                    .buttonStyle(.bordered)
                }
                .padding(24)
                .foregroundStyle(.white)
                .background(Color.black)
                .accessibilityElement(children: .contain)
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct TasksWebViewRepresentable: UIViewRepresentable {
    @ObservedObject var model: TasksBrowserModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let userContentController = WKUserContentController()
        userContentController.add(
            context.coordinator,
            name: TaskCompanionConstants.webBridgeHandler
        )
        var nativeContextScript = """
        window.__bathosNativeApp = Object.freeze({
          schemaVersion: 1,
          moduleId: "tasks"
        });
        """
        if let installationID = try? TaskWidgetInstallationStore()?.identifier() {
            nativeContextScript += """
            window.__bathosTasksNative = Object.freeze({
              schemaVersion: 2,
              installationId: "\(installationID.uuidString.lowercased())"
            });
            """
        }
        userContentController.addUserScript(WKUserScript(
            source: nativeContextScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContentController
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        TasksWebViewPolicy.apply(to: configuration)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.isOpaque = true
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        model.attach(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.webView = webView
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: TaskCompanionConstants.webBridgeHandler
        )
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let model: TasksBrowserModel

        init(model: TasksBrowserModel) {
            self.model = model
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            model.acceptBridgeMessage(message)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.scheme?.lowercased() == TaskNativeRoute.scheme {
                model.open(TaskNativeRoute.parse(url))
                decisionHandler(.cancel)
                return
            }
            switch TasksWebNavigationPolicy.disposition(for: url) {
            case .allow:
                decisionHandler(.allow)
            case .openExternally:
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            case .cancel:
                decisionHandler(.cancel)
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.didStartLoading()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.didFinishLoading()
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            model.didFailLoading(error)
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            model.didFailLoading(error)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            model.didTerminateWebContent()
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}
