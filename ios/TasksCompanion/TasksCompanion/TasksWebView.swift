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
        context.coordinator.attachSummaryKeyboardPresenter(to: webView)
        model.attach(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.webView = webView
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.detachSummaryKeyboardPresenter()
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: TaskCompanionConstants.webBridgeHandler
        )
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let model: TasksBrowserModel
        private let summaryKeyboardPresenter = TasksSummaryKeyboardPresenter()

        init(model: TasksBrowserModel) {
            self.model = model
        }

        func attachSummaryKeyboardPresenter(to webView: WKWebView) {
            summaryKeyboardPresenter.attach(to: webView)
            model.presentSummaryKeyboard = { [weak summaryKeyboardPresenter] webView in
                summaryKeyboardPresenter?.present(in: webView) == true
            }
        }

        func detachSummaryKeyboardPresenter() {
            model.presentSummaryKeyboard = nil
            summaryKeyboardPresenter.detach()
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

@MainActor
final class TasksSummaryKeyboardPresenter: NSObject {
    private static let transferDelay: TimeInterval = 0.75
    private static let activationRetryDelay: TimeInterval = 0.05
    private static let maximumActivationAttempts = 20

    private weak var webView: WKWebView?
    private weak var captureField: UITextField?
    private var isTransferPending = false
    private var activationWorkItem: DispatchWorkItem?
    private var transferWorkItem: DispatchWorkItem?

    func attach(to webView: WKWebView) {
        detach()

        let captureField = UITextField(frame: .zero)
        captureField.translatesAutoresizingMaskIntoConstraints = false
        captureField.alpha = 0.01
        captureField.isAccessibilityElement = false
        captureField.accessibilityElementsHidden = true
        captureField.autocorrectionType = .no
        captureField.spellCheckingType = .no
        captureField.textContentType = nil
        captureField.returnKeyType = .done

        webView.addSubview(captureField)
        NSLayoutConstraint.activate([
            captureField.widthAnchor.constraint(equalToConstant: 1),
            captureField.heightAnchor.constraint(equalToConstant: 1),
            captureField.trailingAnchor.constraint(
                equalTo: webView.trailingAnchor,
                constant: -1
            ),
            captureField.bottomAnchor.constraint(
                equalTo: webView.bottomAnchor,
                constant: -1
            ),
        ])

        self.webView = webView
        self.captureField = captureField
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardDidShow),
            name: UIResponder.keyboardDidShowNotification,
            object: nil
        )
    }

    func present(in webView: WKWebView) -> Bool {
        guard self.webView === webView,
              captureField != nil else {
            return false
        }

        activationWorkItem?.cancel()
        transferWorkItem?.cancel()
        requestKeyboardActivation(
            in: webView,
            remainingAttempts: Self.maximumActivationAttempts
        )
        return true
    }

    func detach() {
        NotificationCenter.default.removeObserver(self)
        activationWorkItem?.cancel()
        activationWorkItem = nil
        transferWorkItem?.cancel()
        transferWorkItem = nil
        isTransferPending = false
        captureField?.resignFirstResponder()
        captureField?.removeFromSuperview()
        captureField = nil
        webView = nil
    }

    @objc private func keyboardDidShow() {
        transferToWebSummary()
    }

    private func requestKeyboardActivation(
        in webView: WKWebView,
        remainingAttempts: Int
    ) {
        guard self.webView === webView,
              let captureField else {
            return
        }
        guard captureField.window?.isKeyWindow == true else {
            guard remainingAttempts > 0 else {
                return
            }
            let workItem = DispatchWorkItem { [weak self, weak webView] in
                guard let self, let webView else {
                    return
                }
                self.requestKeyboardActivation(
                    in: webView,
                    remainingAttempts: remainingAttempts - 1
                )
            }
            activationWorkItem = workItem
            DispatchQueue.main.asyncAfter(
                deadline: .now() + Self.activationRetryDelay,
                execute: workItem
            )
            return
        }

        activationWorkItem?.cancel()
        activationWorkItem = nil
        isTransferPending = true
        guard captureField.becomeFirstResponder() else {
            isTransferPending = false
            return
        }

        let workItem = DispatchWorkItem { [weak self] in
            self?.transferToWebSummary()
        }
        transferWorkItem = workItem
        DispatchQueue.main.asyncAfter(
            deadline: .now() + Self.transferDelay,
            execute: workItem
        )
    }

    private func transferToWebSummary() {
        guard isTransferPending,
              let webView,
              let captureField,
              captureField.isFirstResponder else {
            return
        }
        isTransferPending = false
        transferWorkItem?.cancel()
        transferWorkItem = nil

        webView.evaluateJavaScript(
            TasksBrowserModel.newTaskSummaryFocusJavaScript
        ) { @MainActor result, _ in
            let focused = (result as? Bool) == true
            let activated = focused && webView.becomeFirstResponder()
            if !activated {
                captureField.resignFirstResponder()
            }
        }
    }
}
