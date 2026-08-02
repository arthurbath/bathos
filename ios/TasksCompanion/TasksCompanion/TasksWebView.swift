import SwiftUI
import UIKit
import WebKit

enum TasksCompanionAppearance {
    static let applicationBackground = UIColor(
        red: 13.0 / 255.0,
        green: 13.0 / 255.0,
        blue: 13.0 / 255.0,
        alpha: 1
    )
}

enum TasksWebViewPolicy {
    static func apply(to configuration: WKWebViewConfiguration) {
        configuration.websiteDataStore = .default()
        configuration.limitsNavigationsToAppBoundDomains = true
    }
}

enum TasksWebViewScrollPolicy {
    static func apply(to scrollView: UIScrollView) {
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.bounces = true
        scrollView.alwaysBounceVertical = true
        scrollView.alwaysBounceHorizontal = false
        scrollView.isDirectionalLockEnabled = true
        scrollView.decelerationRate = .normal
    }
}

@MainActor
final class TasksCommandWebView: WKWebView {
    var onShake: (() -> Void)?

    @discardableResult
    func handleCompletedMotion(_ motion: UIEvent.EventSubtype) -> Bool {
        guard motion == .motionShake else {
            return false
        }
        onShake?()
        return true
    }

    override func motionEnded(
        _ motion: UIEvent.EventSubtype,
        with event: UIEvent?
    ) {
        if handleCompletedMotion(motion) {
            return
        }
        super.motionEnded(motion, with: event)
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
                .background(Color(uiColor: TasksCompanionAppearance.applicationBackground))
                .opacity(model.hasLoadedContent ? 1 : 0)

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
                .background(Color(uiColor: TasksCompanionAppearance.applicationBackground))
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
        document.addEventListener("pointerdown", (event) => {
          const target = event.target instanceof Element
            ? event.target.closest("input, textarea, [contenteditable]:not([contenteditable='false'])")
            : null;
          if (!target) return;
          window.webkit?.messageHandlers?.\(TaskCompanionConstants.webBridgeHandler)?.postMessage({
            type: "\(TasksBrowserModel.webTextInputEngagedMessageType)",
            schemaVersion: 2
          });
        }, true);
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

        let webView = TasksCommandWebView(frame: .zero, configuration: configuration)
        webView.onShake = { [weak model] in
            model?.requestTaskUndo()
        }
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        TasksWebViewScrollPolicy.apply(to: webView.scrollView)
        webView.isOpaque = false
        webView.backgroundColor = TasksCompanionAppearance.applicationBackground
        webView.scrollView.backgroundColor = TasksCompanionAppearance.applicationBackground
        context.coordinator.attachSummaryKeyboardPresenter(to: webView)
        model.attach(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.webView = webView
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.detachSummaryKeyboardPresenter()
        (webView as? TasksCommandWebView)?.onShake = nil
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
            model.dismissSummaryKeyboard = { [weak summaryKeyboardPresenter] in
                summaryKeyboardPresenter?.dismiss()
            }
        }

        func detachSummaryKeyboardPresenter() {
            model.presentSummaryKeyboard = nil
            model.dismissSummaryKeyboard = nil
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
final class TasksSummaryKeyboardPresenter: NSObject, UITextFieldDelegate {
    private static let activationRetryDelay: TimeInterval = 0.05
    private static let maximumActivationAttempts = 20

    private weak var webView: WKWebView?
    private weak var captureField: UITextField?
    private var activationWorkItem: DispatchWorkItem?
    private var isSynchronizingText = false

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
        captureField.delegate = self
        captureField.addTarget(
            self,
            action: #selector(captureTextChanged),
            for: .editingChanged
        )

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
    }

    func present(in webView: WKWebView) -> Bool {
        guard self.webView === webView,
              captureField != nil else {
            return false
        }

        activationWorkItem?.cancel()
        webView.evaluateJavaScript(
            TasksBrowserModel.newTaskSummaryValueJavaScript
        ) { @MainActor [weak self, weak webView] result, _ in
            guard let self, let webView,
                  self.webView === webView,
                  let captureField = self.captureField else {
                return
            }
            self.isSynchronizingText = true
            captureField.text = result as? String ?? ""
            captureField.selectedTextRange = captureField.textRange(
                from: captureField.endOfDocument,
                to: captureField.endOfDocument
            )
            self.isSynchronizingText = false
            self.requestKeyboardActivation(
                in: webView,
                remainingAttempts: Self.maximumActivationAttempts
            )
        }
        return true
    }

    func dismiss() {
        activationWorkItem?.cancel()
        activationWorkItem = nil
        captureField?.resignFirstResponder()
    }

    func detach() {
        dismiss()
        captureField?.removeTarget(
            self,
            action: #selector(captureTextChanged),
            for: .editingChanged
        )
        captureField?.delegate = nil
        captureField?.removeFromSuperview()
        captureField = nil
        webView = nil
    }

    @objc private func captureTextChanged() {
        guard !isSynchronizingText,
              let value = captureField?.text,
              let script = TasksBrowserModel.updateNewTaskSummaryJavaScript(value) else {
            return
        }
        webView?.evaluateJavaScript(script)
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        webView?.evaluateJavaScript(
            TasksBrowserModel.submitNewTaskSummaryJavaScript
        )
        textField.resignFirstResponder()
        return false
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
        _ = captureField.becomeFirstResponder()
    }
}
