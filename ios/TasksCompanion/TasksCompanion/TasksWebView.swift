import SwiftUI
import UIKit
import WebKit

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

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContentController
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()

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
            if url.scheme == "about" {
                decisionHandler(.allow)
                return
            }
            if url.scheme?.lowercased() == "https",
               url.host?.lowercased() == TaskCompanionConstants.trustedWebHost {
                decisionHandler(.allow)
                return
            }
            if ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
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
