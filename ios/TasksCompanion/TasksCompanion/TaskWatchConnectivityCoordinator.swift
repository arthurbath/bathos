import Foundation
import WatchConnectivity

final class TaskWatchConnectivityCoordinator: NSObject, WCSessionDelegate {
    static let shared = TaskWatchConnectivityCoordinator()

    private let session: WCSession?
    private var pendingContext: [String: Any]?

    private override init() {
        session = WCSession.isSupported() ? .default : nil
        super.init()
        session?.delegate = self
    }

    func activate() {
        session?.activate()
        guard let credentialStore = TaskWidgetCredentialStore() else { return }
        do {
            publish(try credentialStore.load())
        } catch {
            publish(nil)
        }
    }

    func publish(_ credential: TaskWidgetCredential?) {
        var context: [String: Any] = ["schemaVersion": 1]
        if let credential {
            let watchCredential = TaskWatchCredential(
                schemaVersion: TaskWatchCredential.schemaVersion,
                ownerId: credential.ownerId,
                credential: credential.credential,
                expiresAt: credential.expiresAt
            )
            context["credential"] = try? JSONEncoder().encode(watchCredential)
        } else {
            context["clear"] = true
        }
        pendingContext = context
        flushContextIfActive()
    }

    private func flushContextIfActive() {
        guard let session,
              session.activationState == .activated,
              let pendingContext else { return }
        do {
            try session.updateApplicationContext(pendingContext)
            self.pendingContext = nil
        } catch {
            return
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        flushContextIfActive()
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}
