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
        pendingContext = makeCredentialPayload(credential)
        flushContextIfActive()
    }

    private func currentCredentialPayload() -> [String: Any] {
        let credential = try? TaskWidgetCredentialStore()?.load()
        return makeCredentialPayload(credential)
    }

    private func makeCredentialPayload(
        _ credential: TaskWidgetCredential?
    ) -> [String: Any] {
        let watchCredential = credential.map {
            TaskWatchCredential(
                schemaVersion: TaskWatchCredential.schemaVersion,
                ownerId: $0.ownerId,
                credential: $0.credential,
                expiresAt: $0.expiresAt
            )
        }
        return TaskWatchConnectivityMessage.credentialPayload(watchCredential)
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

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        guard TaskWatchConnectivityMessage.isCredentialRequest(message) else {
            replyHandler([:])
            return
        }
        replyHandler(currentCredentialPayload())
    }

    func session(
        _ session: WCSession,
        didReceiveUserInfo userInfo: [String: Any]
    ) {
        guard TaskWatchConnectivityMessage.isCredentialRequest(userInfo) else { return }
        let payload = currentCredentialPayload()
        pendingContext = payload
        flushContextIfActive()
        guard session.activationState == .activated else { return }
        session.transferUserInfo(payload)
    }
}
