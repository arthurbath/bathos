import Foundation

enum TaskNativeRoute: Equatable {
    case list(TaskWidgetListID)
    case task(UUID, list: TaskWidgetListID)

    static let scheme = "bathostasks"
    static let productionOrigin = URL(string: "https://os.bath.garden")!

    static func parse(_ url: URL) -> TaskNativeRoute {
        guard url.scheme?.lowercased() == scheme else {
            return .list(.today)
        }
        let pathComponent = url.pathComponents.dropFirst().first
        switch url.host?.lowercased() {
        case "list":
            return pathComponent
                .flatMap(TaskWidgetListID.init(rawValue:))
                .map(TaskNativeRoute.list) ?? .list(.today)
        case "task":
            guard let pathComponent, let taskID = UUID(uuidString: pathComponent) else {
                return .list(.today)
            }
            let selectedList = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first(where: { $0.name == "list" })?
                .value
                .flatMap(TaskWidgetListID.init(rawValue:)) ?? .today
            return .task(taskID, list: selectedList)
        default:
            return .list(.today)
        }
    }

    var webURL: URL {
        let listID: TaskWidgetListID
        let taskID: UUID?
        switch self {
        case .list(let list):
            listID = list
            taskID = nil
        case .task(let id, let list):
            listID = list
            taskID = id
        }

        var components = URLComponents(
            url: Self.productionOrigin.appending(path: "tasks/\(listID.rawValue)"),
            resolvingAgainstBaseURL: false
        )!
        if let taskID {
            components.queryItems = [
                URLQueryItem(name: "native_task", value: taskID.uuidString.lowercased()),
            ]
        }
        return components.url ?? Self.productionOrigin.appending(path: "tasks/today")
    }

    var deepLinkURL: URL {
        switch self {
        case .list(let list):
            return URL(string: "\(Self.scheme)://list/\(list.rawValue)")!
        case .task(let id, let list):
            var components = URLComponents()
            components.scheme = Self.scheme
            components.host = "task"
            components.path = "/\(id.uuidString.lowercased())"
            components.queryItems = [URLQueryItem(name: "list", value: list.rawValue)]
            return components.url!
        }
    }
}

enum TaskCompanionURLAction: Equatable {
    case task(TaskNativeRoute)
    case external(URL)
    case ignore

    static func resolve(_ url: URL) -> TaskCompanionURLAction {
        switch url.scheme?.lowercased() {
        case TaskNativeRoute.scheme:
            return .task(TaskNativeRoute.parse(url))
        case "http", "https", "message":
            return .external(url)
        default:
            return .ignore
        }
    }
}
