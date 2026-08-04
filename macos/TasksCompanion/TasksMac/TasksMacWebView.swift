import AppKit
import SwiftUI
import WebKit

enum TasksMacAppearance {
    static let applicationBackground = NSColor(
        calibratedRed: 13.0 / 255.0,
        green: 13.0 / 255.0,
        blue: 13.0 / 255.0,
        alpha: 1
    )
}

enum TasksMacWebViewPolicy {
    static func apply(to configuration: WKWebViewConfiguration) {
        configuration.websiteDataStore = .default()
        configuration.limitsNavigationsToAppBoundDomains = true
    }
}

final class TasksFirstMouseWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }
}

enum TasksMacWebNavigationDisposition: Equatable {
    case allow
    case openExternally
    case cancel
}

enum TasksMacWebNavigationPolicy {
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

    static func disposition(for url: URL) -> TasksMacWebNavigationDisposition {
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

struct TasksMacWebView: View {
    @ObservedObject var model: TasksBrowserModel
    var waitsForQuickEntryPresentation = false

    private var contentIsVisible: Bool {
        model.hasLoadedContent
            && (!waitsForQuickEntryPresentation || model.quickEntryPresentationReady)
    }

    var body: some View {
        ZStack {
            Color(nsColor: TasksMacAppearance.applicationBackground)
                .ignoresSafeArea()

            TasksMacWebViewRepresentable(model: model)
                .opacity(contentIsVisible ? 1 : 0)

            if !contentIsVisible && model.loadError == nil {
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)
                    .accessibilityLabel("Loading Tasks")
            }

            if let loadError = model.loadError, !contentIsVisible {
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
                .accessibilityElement(children: .contain)
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct TasksMacWebViewRepresentable: NSViewRepresentable {
    @ObservedObject var model: TasksBrowserModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeNSView(context: Context) -> WKWebView {
        let userContentController = WKUserContentController()
        userContentController.add(
            context.coordinator,
            name: TaskCompanionConstants.webBridgeHandler
        )

        let shortcutDisplay = TasksGlobalShortcutStore.display(
            TasksGlobalShortcutStore.load()
        )
        let shortcutLiteral = (
            try? JSONEncoder().encode(shortcutDisplay)
        ).flatMap {
            String(data: $0, encoding: .utf8)
        } ?? "null"
        var nativeContextScript = """
        window.__bathosNativeApp = Object.freeze({
          schemaVersion: 1,
          moduleId: "tasks",
          platform: "macos",
          quickEntryShortcut: \(shortcutLiteral)
        });
        """
        if let installationID = try? TaskWidgetInstallationStore()?.identifier() {
            nativeContextScript += """
            window.__bathosTasksNative = Object.freeze({
              schemaVersion: 2,
              installationId: "\(installationID.uuidString.lowercased())",
              notificationsEnabled: false
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
        TasksMacWebViewPolicy.apply(to: configuration)

        let webView = TasksFirstMouseWebView(
            frame: .zero,
            configuration: configuration
        )
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsMagnification = true
#if DEBUG
        if #available(macOS 13.3, *) {
            webView.isInspectable = true
        }
#endif
        model.attach(webView)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        model.webView = webView
    }

    static func dismantleNSView(_ webView: WKWebView, coordinator: Coordinator) {
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
            switch TasksMacWebNavigationPolicy.disposition(for: url) {
            case .allow:
                decisionHandler(.allow)
            case .openExternally:
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
            case .cancel:
                decisionHandler(.cancel)
            }
        }

        func webView(
            _ webView: WKWebView,
            didStartProvisionalNavigation navigation: WKNavigation!
        ) {
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
                NSWorkspace.shared.open(url)
            }
            return nil
        }
    }
}
