import Foundation
import OSLog
@preconcurrency import UserNotifications
import WebKit
import WidgetKit
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

@MainActor
final class TasksBrowserModel: NSObject, ObservableObject {
    typealias InPageNavigator = @MainActor (WKWebView, URL) -> Void

    static let newTaskSummaryFocusMessageType = "focus-new-task-summary"
    static let webTextInputEngagedMessageType = "web-text-input-engaged"
    static let configureQuickEntryShortcutMessageType =
        "configure-quick-entry-shortcut"
    static let clearQuickEntryShortcutMessageType =
        "clear-quick-entry-shortcut"
    static let quickEntryCredentialMessageType = "quick-entry-credential"
    static let contentReadyMessageType = "content-ready"
    static let requestNotificationStatusMessageType =
        "request-notification-status"
    static let configureNotificationsMessageType =
        "configure-notifications"
    static let syncRemindersMessageType = "sync-reminders"
    static let newTaskSummaryInputIdentifier = "task-title-task-draft:new"
    static let newTaskSummaryFocusJavaScript = """
    (() => {
      const input = document.getElementById("task-title-task-draft:new");
      if (!(input instanceof HTMLInputElement)) return false;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
      return document.activeElement === input;
    })();
    """
    static let newTaskSummaryValueJavaScript = """
    (() => {
      const input = document.getElementById("task-title-task-draft:new");
      return input instanceof HTMLInputElement ? input.value : null;
    })();
    """
    static func updateNewTaskSummaryJavaScript(_ value: String) -> String? {
        guard let data = try? JSONEncoder().encode(value),
              let literal = String(data: data, encoding: .utf8) else {
            return nil
        }
        return """
        (() => {
          const input = document.getElementById("task-title-task-draft:new");
          if (!(input instanceof HTMLInputElement)) return false;
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          )?.set;
          if (!setter) return false;
          setter.call(input, \(literal));
          input.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertText"
          }));
          input.setSelectionRange(input.value.length, input.value.length);
          return true;
        })();
        """
    }
    static let submitNewTaskSummaryJavaScript = """
    (() => {
      const input = document.getElementById("task-title-task-draft:new");
      if (!(input instanceof HTMLInputElement)) return false;
      return !input.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true
      }));
    })();
    """
    static let taskUndoCommandJavaScript = """
    window.dispatchEvent(new CustomEvent("bathos:tasks-native-command", {
      detail: {
        schemaVersion: 1,
        command: "undo"
      }
    }));
    """
    static let nativeAppActiveJavaScript = """
    window.dispatchEvent(new CustomEvent("bathos:tasks-native-app-active"));
    """
    static let reloadSafeWebsiteDataTypes: Set<String> = [
        WKWebsiteDataTypeDiskCache,
        WKWebsiteDataTypeFetchCache,
        WKWebsiteDataTypeMemoryCache,
        WKWebsiteDataTypeOfflineWebApplicationCache,
    ]

    private static let logger = Logger(
        subsystem: "garden.bath.tasks",
        category: "WidgetBridge"
    )

    @Published private(set) var requestedURL = TaskNativeRoute.list(.today).webURL
    @Published private(set) var isLoading = true
    @Published private(set) var hasLoadedContent = false
    @Published private(set) var loadError: String?

    weak var webView: WKWebView?
    var presentSummaryKeyboard: ((WKWebView) -> Bool)?
    var dismissSummaryKeyboard: (() -> Void)?
    var configureQuickEntryShortcut: ((
        TaskQuickEntryShortcutPayload
    ) -> TaskQuickEntryShortcutResponse)?
    var clearQuickEntryShortcut: (() -> TaskQuickEntryShortcutResponse)?

    private let coldStartRecoveryDelayNanoseconds: UInt64
    private let contentReadyFallbackDelayNanoseconds: UInt64
    private let inPageNavigator: InPageNavigator
    private var coldStartRecoveryTask: Task<Void, Never>?
    private var contentReadyFallbackTask: Task<Void, Never>?
    private var isPerformingColdStartRecovery = false
    private var navigationDidFinish = false
    private var contentReadyReceived = false

    init(
        coldStartRecoveryDelayNanoseconds: UInt64 = 400_000_000,
        contentReadyFallbackDelayNanoseconds: UInt64 = 2_000_000_000,
        inPageNavigator: @escaping InPageNavigator = TasksBrowserModel.navigateInPage
    ) {
        self.coldStartRecoveryDelayNanoseconds = coldStartRecoveryDelayNanoseconds
        self.contentReadyFallbackDelayNanoseconds =
            contentReadyFallbackDelayNanoseconds
        self.inPageNavigator = inPageNavigator
    }

    private static func recordBridgeDiagnostic(_ message: String) {
        logger.notice("\(message, privacy: .public)")
    }

    func attach(_ webView: WKWebView) {
        self.webView = webView
        TaskNativeNotificationCoordinator.shared.bind(to: self)
        if webView.url == nil {
            hasLoadedContent = false
            webView.load(URLRequest(url: requestedURL))
        }
    }

    func open(_ route: TaskNativeRoute) {
        openWebURL(route.webURL)
    }

    func openWebURL(_ nextURL: URL) {
        cancelColdStartRecovery()
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

    func reloadClearingCache() {
        cancelColdStartRecovery()
        loadError = nil
        isLoading = true
        URLCache.shared.removeAllCachedResponses()

        guard let webView else {
            return
        }
        let fallbackURL = requestedURL
        webView.configuration.websiteDataStore.removeData(
            ofTypes: Self.reloadSafeWebsiteDataTypes,
            modifiedSince: .distantPast
        ) { [weak webView] in
            Task { @MainActor in
                guard let webView else {
                    return
                }
                if webView.url != nil {
                    webView.reloadFromOrigin()
                } else {
                    webView.load(URLRequest(
                        url: fallbackURL,
                        cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
                    ))
                }
            }
        }
    }

    func requestTaskUndo() {
        webView?.evaluateJavaScript(Self.taskUndoCommandJavaScript)
    }

    func notifyNativeAppBecameActive() {
        webView?.evaluateJavaScript(Self.nativeAppActiveJavaScript)
        TaskNativeNotificationCoordinator.shared.refreshAuthorization()
    }

    func didStartLoading() {
        if !hasLoadedContent {
            resetContentReadiness()
        }
        isLoading = true
        loadError = nil
    }

    func didFinishLoading() {
        cancelColdStartRecovery()
        loadError = nil
        navigationDidFinish = true
        if contentReadyReceived {
            revealReadyContent()
            return
        }
        scheduleContentReadyFallback()
    }

    func didBecomeContentReady() {
        contentReadyReceived = true
        guard navigationDidFinish else {
            return
        }
        revealReadyContent()
    }

    func performContentReadyFallback() {
        guard navigationDidFinish, !hasLoadedContent else {
            return
        }
        revealReadyContent()
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
        resetContentReadiness()
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

    private func scheduleContentReadyFallback() {
        contentReadyFallbackTask?.cancel()
        contentReadyFallbackTask = Task { @MainActor [weak self] in
            guard let self else {
                return
            }
            try? await Task.sleep(
                nanoseconds: self.contentReadyFallbackDelayNanoseconds
            )
            guard !Task.isCancelled else {
                return
            }
            self.performContentReadyFallback()
        }
    }

    private func revealReadyContent() {
        contentReadyFallbackTask?.cancel()
        contentReadyFallbackTask = nil
        isLoading = false
        hasLoadedContent = true
        loadError = nil
    }

    private func resetContentReadiness() {
        contentReadyFallbackTask?.cancel()
        contentReadyFallbackTask = nil
        navigationDidFinish = false
        contentReadyReceived = false
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

    func focusNewTaskSummary(in webView: WKWebView) {
        webView.evaluateJavaScript(Self.newTaskSummaryFocusJavaScript) {
            @MainActor [weak self] result,
            error in
            guard let self else {
                return
            }
            Self.finishNewTaskSummaryFocus(
                result: result,
                error: error,
                activateFirstResponder: {
                    if let presentSummaryKeyboard = self.presentSummaryKeyboard {
                        return presentSummaryKeyboard(webView)
                    }
                    return webView.becomeFirstResponder()
                }
            )
        }
    }

    @discardableResult
    static func finishNewTaskSummaryFocus(
        result: Any?,
        error: Error?,
        activateFirstResponder: () -> Bool
    ) -> Bool {
        if let error {
            recordBridgeDiagnostic(
                "Summary focus failed: \(String(describing: error))"
            )
            return false
        }
        guard (result as? Bool) == true else {
            recordBridgeDiagnostic("Summary focus completed: false")
            return false
        }
        let activated = activateFirstResponder()
        recordBridgeDiagnostic(
            "Summary focus completed: true; responder activated: \(activated)"
        )
        return activated
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
#if os(macOS)
        if envelope.type == Self.quickEntryCredentialMessageType {
            guard let message = try? JSONDecoder().decode(
                TaskNativeQuickEntryCredentialBridgeMessage.self,
                from: data
            ) else {
                Self.recordBridgeDiagnostic("Rejected: invalid Quick Entry credential")
                return
            }
            let credential = TasksNativeQuickEntryCredential(
                payloadSchemaVersion: message.payloadSchemaVersion,
                contractFingerprint: message.contractFingerprint,
                capability: message.capability,
                ownerId: message.ownerId,
                installationId: message.installationId,
                credential: message.credential,
                expiresAt: message.expiresAt
            )
            do {
                try credential.validate()
                guard let installationID = try TaskWidgetInstallationStore()?.identifier(),
                      installationID == credential.installationId else {
                    Self.recordBridgeDiagnostic("Rejected: Quick Entry installation mismatch")
                    return
                }
                try TasksNativeQuickEntryCredentialStore().store(credential)
                Self.recordBridgeDiagnostic("Accepted: \(envelope.type)")
            } catch {
                Self.recordBridgeDiagnostic(
                    "Rejected: Quick Entry credential validation or persistence"
                )
            }
            return
        }
#endif
        if envelope.type == Self.configureQuickEntryShortcutMessageType {
            guard let request = try? JSONDecoder().decode(
                TaskQuickEntryShortcutBridgeMessage.self,
                from: data
            ) else {
                Self.recordBridgeDiagnostic("Rejected: invalid shortcut request")
                return
            }
            let response = configureQuickEntryShortcut?(request.shortcut)
                ?? TaskQuickEntryShortcutResponse(
                    success: false,
                    display: nil,
                    message: "The native shortcut recorder is unavailable"
                )
            sendQuickEntryShortcutResponse(response)
            Self.recordBridgeDiagnostic(
                "Accepted: \(envelope.type); success=\(response.success)"
            )
            return
        }
        if envelope.type == Self.clearQuickEntryShortcutMessageType {
            let response = clearQuickEntryShortcut?()
                ?? TaskQuickEntryShortcutResponse(
                    success: false,
                    display: nil,
                    message: "The native shortcut recorder is unavailable"
                )
            sendQuickEntryShortcutResponse(response)
            Self.recordBridgeDiagnostic(
                "Accepted: \(envelope.type); success=\(response.success)"
            )
            return
        }
        if envelope.type == Self.contentReadyMessageType {
            didBecomeContentReady()
            Self.recordBridgeDiagnostic("Accepted: \(envelope.type)")
            return
        }
        if envelope.type == Self.newTaskSummaryFocusMessageType {
            guard let webView else {
                Self.recordBridgeDiagnostic("Rejected: web view unavailable for Summary focus")
                return
            }
            focusNewTaskSummary(in: webView)
            Self.recordBridgeDiagnostic("Accepted: \(envelope.type)")
            return
        }
        if envelope.type == Self.webTextInputEngagedMessageType {
            guard let webView else {
                Self.recordBridgeDiagnostic("Rejected: web view unavailable for text input")
                return
            }
            dismissSummaryKeyboard?()
            let activated = webView.becomeFirstResponder()
            Self.recordBridgeDiagnostic(
                "Accepted: \(envelope.type); responder activated: \(activated)"
            )
            return
        }
        if envelope.type == Self.requestNotificationStatusMessageType {
            TaskNativeNotificationCoordinator.shared.bind(to: self)
            TaskNativeNotificationCoordinator.shared.refreshAuthorization()
            Self.recordBridgeDiagnostic("Accepted: \(envelope.type)")
            return
        }
        if envelope.type == Self.configureNotificationsMessageType {
            TaskNativeNotificationCoordinator.shared.bind(to: self)
            TaskNativeNotificationCoordinator.shared.configureNotifications()
            Self.recordBridgeDiagnostic("Accepted: \(envelope.type)")
            return
        }
        if envelope.type == Self.syncRemindersMessageType {
            guard let reminderProjection = try? JSONDecoder().decode(
                TaskNativeReminderProjection.self,
                from: data
            ), reminderProjection.isValid else {
                Self.recordBridgeDiagnostic("Rejected: invalid reminder projection")
                return
            }
            TaskNativeNotificationCoordinator.shared.bind(to: self)
            TaskNativeNotificationCoordinator.shared.synchronize(reminderProjection)
            Self.recordBridgeDiagnostic(
                "Accepted: \(envelope.type); reminders=\(reminderProjection.reminders.count)"
            )
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
                TaskNativeNotificationCoordinator.shared.clearScheduledReminders()
#if os(iOS)
                TaskWatchConnectivityCoordinator.shared.publish(nil)
#endif
                if let credentialStore = TaskWidgetCredentialStore() {
                    let credential = try? credentialStore.load()
                    _ = try? credentialStore.clear()
                    if let credential {
                        Task {
                            await Self.revokeCredential(credential.credential)
                        }
                    }
                }
#if os(macOS)
                let quickEntryStore = TasksNativeQuickEntryCredentialStore()
                let quickEntryCredential = try? quickEntryStore.load()
                _ = try? quickEntryStore.clear()
                _ = try? TasksNativeQuickEntryBootstrapStore().clear()
                if let quickEntryCredential {
                    Task {
                        await Self.revokeQuickEntryCredential(
                            quickEntryCredential.credential
                        )
                    }
                }
#endif
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
#if os(iOS)
                TaskWatchConnectivityCoordinator.shared.publish(credential)
#endif
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

#if os(macOS)
    private static func revokeQuickEntryCredential(_ credential: String) async {
        var request = URLRequest(url: TaskCompanionConstants.widgetActionsURL)
        request.httpMethod = "POST"
        request.timeoutInterval = 5
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(
            "QuickEntry \(credential)",
            forHTTPHeaderField: "Authorization"
        )
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "action": "revokeQuickEntry",
        ])
        _ = try? await URLSession.shared.data(for: request)
    }
#endif

    private func sendQuickEntryShortcutResponse(
        _ response: TaskQuickEntryShortcutResponse
    ) {
        guard let data = try? JSONEncoder().encode(response),
              let object = try? JSONSerialization.jsonObject(with: data),
              let responseData = try? JSONSerialization.data(
                withJSONObject: object
              ),
              let literal = String(data: responseData, encoding: .utf8) else {
            return
        }
        webView?.evaluateJavaScript("""
        window.dispatchEvent(new CustomEvent(
          "bathos:tasks-native-quick-entry-shortcut",
          { detail: \(literal) }
        ));
        """)
    }

    func sendNativeNotificationStatus(
        _ status: TaskNativeNotificationAuthorizationState
    ) {
        let enabled = status == .enabled ? "true" : "false"
        webView?.evaluateJavaScript("""
        (() => {
          const status = "\(status.rawValue)";
          if (window.__bathosTasksNative) {
            window.__bathosTasksNative.notificationsEnabled = \(enabled);
            window.__bathosTasksNative.notificationAuthorizationStatus = status;
          }
          window.dispatchEvent(new CustomEvent(
            "bathos:tasks-native-notification-status",
            { detail: { status, enabled: \(enabled) } }
          ));
        })();
        """)
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

#if os(macOS)
private struct TaskNativeQuickEntryCredentialBridgeMessage: Decodable {
    let payloadSchemaVersion: Int
    let contractFingerprint: String
    let capability: String
    let ownerId: UUID
    let installationId: UUID
    let credential: String
    let expiresAt: String
}
#endif

struct TaskQuickEntryShortcutPayload: Codable, Equatable {
    let code: String
    let command: Bool
    let control: Bool
    let option: Bool
    let shift: Bool
}

struct TaskQuickEntryShortcutResponse: Codable, Equatable {
    let success: Bool
    let display: String?
    let message: String?
}

private struct TaskQuickEntryShortcutBridgeMessage: Decodable {
    let shortcut: TaskQuickEntryShortcutPayload
}

enum TaskNativeNotificationAuthorizationState: String, Equatable {
    case checking
    case notDetermined = "not-determined"
    case denied
    case enabled
    case unavailable
    case error

    static func resolve(_ status: UNAuthorizationStatus) -> Self {
        switch status {
        case .notDetermined:
            return .notDetermined
        case .denied:
            return .denied
        case .authorized, .provisional:
            return .enabled
#if os(iOS)
        case .ephemeral:
            return .enabled
#endif
        @unknown default:
            return .unavailable
        }
    }
}

struct TaskNativeReminderProjection: Decodable, Equatable {
    static let maximumReminderCount = 256

    let ownerId: UUID
    let generatedAt: String
    let reminders: [TaskNativeReminderProjectionItem]

    var isValid: Bool {
        reminders.count <= Self.maximumReminderCount
            && parseTaskNativeReminderDate(generatedAt) != nil
            && reminders.allSatisfy(\.isValid)
    }

    func scheduledItems(
        after now: Date,
        limit: Int = TaskNativeNotificationCoordinator.maximumScheduledReminders
    ) -> [TaskNativeReminderProjectionItem] {
        reminders.compactMap { item -> (TaskNativeReminderProjectionItem, Date)? in
            guard let date = item.resolvedDate, date > now else {
                return nil
            }
            return (item, date)
        }
        .sorted { left, right in
            left.1 == right.1
                ? left.0.id.uuidString < right.0.id.uuidString
                : left.1 < right.1
        }
        .prefix(max(0, limit))
        .map(\.0)
    }
}

struct TaskNativeReminderProjectionItem: Decodable, Equatable {
    let id: UUID
    let taskId: UUID
    let summary: String
    let resolvedAt: String

    var resolvedDate: Date? {
        parseTaskNativeReminderDate(resolvedAt)
    }

    var isValid: Bool {
        !summary.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && summary.count <= 500
            && resolvedDate != nil
    }
}

private func parseTaskNativeReminderDate(_ value: String) -> Date? {
    let fractionalFormatter = ISO8601DateFormatter()
    fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return fractionalFormatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
}

@MainActor
final class TaskNativeNotificationCoordinator: NSObject,
    UNUserNotificationCenterDelegate
{
    static let shared = TaskNativeNotificationCoordinator()
    nonisolated static let maximumScheduledReminders = 60
    nonisolated static let identifierPrefix = "garden.bath.tasks.reminder."

    private let center = UNUserNotificationCenter.current()
    private weak var browserModel: TasksBrowserModel?
    private var latestProjection: TaskNativeReminderProjection?

    private override init() {
        super.init()
        center.delegate = self
    }

    func bind(to browserModel: TasksBrowserModel) {
        self.browserModel = browserModel
        center.delegate = self
    }

    func refreshAuthorization() {
        browserModel?.sendNativeNotificationStatus(.checking)
        center.getNotificationSettings { [weak self] settings in
            Task { @MainActor in
                guard let self else {
                    return
                }
                let status = TaskNativeNotificationAuthorizationState.resolve(
                    settings.authorizationStatus
                )
                self.browserModel?.sendNativeNotificationStatus(status)
                if status == .enabled, let projection = self.latestProjection {
                    self.reconcile(projection)
                }
            }
        }
    }

    func configureNotifications() {
        center.getNotificationSettings { [weak self] settings in
            Task { @MainActor in
                guard let self else {
                    return
                }
                switch TaskNativeNotificationAuthorizationState.resolve(
                    settings.authorizationStatus
                ) {
                case .notDetermined:
                    self.requestAuthorization()
                case .denied:
                    self.openSystemNotificationSettings()
                    self.browserModel?.sendNativeNotificationStatus(.denied)
                case .enabled:
                    self.browserModel?.sendNativeNotificationStatus(.enabled)
                    if let projection = self.latestProjection {
                        self.reconcile(projection)
                    }
                case .checking, .unavailable, .error:
                    self.browserModel?.sendNativeNotificationStatus(.unavailable)
                }
            }
        }
    }

    func synchronize(_ projection: TaskNativeReminderProjection) {
        latestProjection = projection
        center.getNotificationSettings { [weak self] settings in
            Task { @MainActor in
                guard let self else {
                    return
                }
                let status = TaskNativeNotificationAuthorizationState.resolve(
                    settings.authorizationStatus
                )
                self.browserModel?.sendNativeNotificationStatus(status)
                if status == .enabled {
                    self.reconcile(projection)
                } else {
                    self.removeAppOwnedRequests()
                }
            }
        }
    }

    func clearScheduledReminders() {
        latestProjection = nil
        removeAppOwnedRequests()
    }

    private func requestAuthorization() {
        center.requestAuthorization(options: [.alert, .sound]) { [weak self] _, error in
            Task { @MainActor in
                guard let self else {
                    return
                }
                if error != nil {
                    self.browserModel?.sendNativeNotificationStatus(.error)
                } else {
                    self.refreshAuthorization()
                }
            }
        }
    }

    private func reconcile(_ projection: TaskNativeReminderProjection) {
        let items = projection.scheduledItems(after: Date())
        let desiredIdentifiers = Set(items.map {
            Self.notificationIdentifier(ownerId: projection.ownerId, reminderId: $0.id)
        })
        let notificationCenter = center
        let identifierPrefix = Self.identifierPrefix
        let ownerId = projection.ownerId

        notificationCenter.getPendingNotificationRequests { requests in
            let obsolete = requests.map(\.identifier).filter {
                $0.hasPrefix(identifierPrefix) && !desiredIdentifiers.contains($0)
            }
            notificationCenter.removePendingNotificationRequests(withIdentifiers: obsolete)

            for item in items {
                guard let request = Self.notificationRequest(
                    ownerId: ownerId,
                    item: item,
                    now: Date()
                ) else {
                    continue
                }
                notificationCenter.add(request)
            }
        }

        notificationCenter.getDeliveredNotifications { notifications in
            let obsolete = notifications.map { $0.request.identifier }.filter {
                $0.hasPrefix(identifierPrefix) && !desiredIdentifiers.contains($0)
            }
            notificationCenter.removeDeliveredNotifications(withIdentifiers: obsolete)
        }
    }

    private func removeAppOwnedRequests() {
        let notificationCenter = center
        let identifierPrefix = Self.identifierPrefix
        notificationCenter.getPendingNotificationRequests { requests in
            let identifiers = requests.map(\.identifier).filter {
                $0.hasPrefix(identifierPrefix)
            }
            notificationCenter.removePendingNotificationRequests(withIdentifiers: identifiers)
        }
        notificationCenter.getDeliveredNotifications { notifications in
            let identifiers = notifications.map { $0.request.identifier }.filter {
                $0.hasPrefix(identifierPrefix)
            }
            notificationCenter.removeDeliveredNotifications(withIdentifiers: identifiers)
        }
    }

    private func openSystemNotificationSettings() {
#if os(iOS)
        let settingsURL = URL(string: UIApplication.openNotificationSettingsURLString)
            ?? URL(string: UIApplication.openSettingsURLString)
        if let settingsURL {
            UIApplication.shared.open(settingsURL)
        }
#elseif os(macOS)
        if let settingsURL = URL(
            string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension"
        ) {
            NSWorkspace.shared.open(settingsURL)
        }
#endif
    }

    nonisolated static func notificationIdentifier(ownerId: UUID, reminderId: UUID) -> String {
        "\(identifierPrefix)\(ownerId.uuidString.lowercased()).\(reminderId.uuidString.lowercased())"
    }

    nonisolated static func notificationRequest(
        ownerId: UUID,
        item: TaskNativeReminderProjectionItem,
        now: Date
    ) -> UNNotificationRequest? {
        guard let date = item.resolvedDate, date > now else {
            return nil
        }
        let content = UNMutableNotificationContent()
        content.title = "Reminder"
        content.body = item.summary.trimmingCharacters(in: .whitespacesAndNewlines)
        content.sound = .default
        content.userInfo = [
            "taskId": item.taskId.uuidString.lowercased(),
            "ownerId": ownerId.uuidString.lowercased(),
        ]
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(1, date.timeIntervalSince(now)),
            repeats: false
        )
        return UNNotificationRequest(
            identifier: notificationIdentifier(ownerId: ownerId, reminderId: item.id),
            content: content,
            trigger: trigger
        )
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (
            UNNotificationPresentationOptions
        ) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let taskId = response.notification.request.content.userInfo["taskId"] as? String
        Task { @MainActor [weak self] in
            defer { completionHandler() }
            guard let taskId, let identifier = UUID(uuidString: taskId) else {
                return
            }
            self?.browserModel?.open(.task(identifier, list: .today))
        }
    }
}
