import Foundation

enum TaskNativeRoute: Equatable {
    case list(TaskWidgetListID)
    case task(UUID, list: TaskWidgetListID)
    case newTask
    case newTaskInList(TaskWidgetListID)

    static let scheme = "bathostasks"
    static let productionOrigin = URL(string: "https://os.bath.garden")!

    static func parse(_ url: URL) -> TaskNativeRoute {
        guard url.scheme?.lowercased() == scheme else {
            return .list(.today)
        }
        let routePathComponents = Array(url.pathComponents.dropFirst())
        let pathComponent = routePathComponents.first
        switch url.host?.lowercased() {
        case "new":
            guard routePathComponents.count <= 1,
                  URLComponents(url: url, resolvingAgainstBaseURL: false)?
                    .queryItems?
                    .isEmpty != false else {
                return .list(.today)
            }
            guard let pathComponent else {
                return .newTask
            }
            guard let listID = TaskWidgetListID(rawValue: pathComponent),
                  TaskWidgetListID.widgetConfigurationCases.contains(listID) else {
                return .list(.today)
            }
            return .newTaskInList(listID)
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
        if case .newTask = self {
            var components = URLComponents(
                url: Self.productionOrigin.appending(path: "tasks/today"),
                resolvingAgainstBaseURL: false
            )!
            components.queryItems = [
                URLQueryItem(name: "native_new_task", value: "1"),
            ]
            return components.url ?? Self.productionOrigin.appending(path: "tasks/today")
        }
        if case .newTaskInList(let listID) = self {
            var components = URLComponents(
                url: Self.productionOrigin.appending(path: "tasks/\(listID.rawValue)"),
                resolvingAgainstBaseURL: false
            )!
            components.queryItems = [
                URLQueryItem(name: "native_new_task", value: "list"),
            ]
            return components.url ?? Self.productionOrigin.appending(path: "tasks/\(listID.rawValue)")
        }

        let listID: TaskWidgetListID
        let taskID: UUID?
        switch self {
        case .list(let list):
            listID = list
            taskID = nil
        case .task(let id, let list):
            listID = list
            taskID = id
        case .newTask:
            preconditionFailure("Handled before list route resolution")
        case .newTaskInList:
            preconditionFailure("Handled before list route resolution")
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
        case .newTask:
            return URL(string: "\(Self.scheme)://new")!
        case .newTaskInList(let list):
            return URL(string: "\(Self.scheme)://new/\(list.rawValue)")!
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
