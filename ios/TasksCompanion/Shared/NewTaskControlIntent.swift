import AppIntents

@available(iOS 18.0, *)
enum NewTaskControlTarget: String, AppEnum, URLRepresentableEnum {
    case todayInbox

    static var typeDisplayRepresentation = TypeDisplayRepresentation("New Task Destination")
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .todayInbox: DisplayRepresentation("Today Inbox"),
    ]
    static var urlRepresentation = URLRepresentation([
        NewTaskControlTarget.todayInbox: "bathostasks://new",
    ])
}

@available(iOS 18.0, *)
struct OpenNewTaskIntent: OpenIntent, URLRepresentableIntent {
    static var title: LocalizedStringResource = "New Task"

    @Parameter(title: "Destination")
    var target: NewTaskControlTarget

    init() {
        target = .todayInbox
    }

    init(target: NewTaskControlTarget) {
        self.target = target
    }
}
