import SwiftUI
import UniformTypeIdentifiers

struct TasksNativeQuickEntryView: View {
    @ObservedObject var model: TasksNativeQuickEntryViewModel

    @FocusState private var focusedField: TasksNativeQuickEntryFocusTarget?
    @State private var showsStartPicker = false
    @State private var showsDeadlinePicker = false
    @State private var draggedChecklistItemID: UUID?

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                header

                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(
                            TasksNativeQuickEntryContract.layoutSections,
                            id: \.id
                        ) { section in
                            editorSection(section.id)
                        }
                        submissionError
                    }
                    .padding(.horizontal, 28)
                    .padding(.vertical, 16)
                }

                footer
            }

            calendarLayer
        }
        .foregroundStyle(.white)
        .background(Color(nsColor: TasksMacAppearance.applicationBackground))
        .preferredColorScheme(.dark)
        .onAppear {
            focusedField = .summary
        }
        .onChange(of: model.draft.focus) { _, newFocus in
            DispatchQueue.main.async {
                focusedField = newFocus
            }
        }
        .onChange(of: model.pickerRequest) { _, request in
            guard let request else { return }
            switch request.kind {
            case .start:
                showsStartPicker = true
                showsDeadlinePicker = false
            case .deadline:
                showsDeadlinePicker = true
                showsStartPicker = false
            }
        }
        .onChange(of: focusedField) { oldFocus, newFocus in
            if let newFocus {
                model.draft.focus = newFocus
            }
            guard case let .checklist(oldItemID) = oldFocus else { return }
            let retainedID: UUID?
            if case let .checklist(newItemID) = newFocus {
                retainedID = newItemID
            } else {
                retainedID = nil
            }
            if oldItemID != retainedID {
                model.draft.discardBlankChecklistItems(except: retainedID)
            }
        }
    }

    @ViewBuilder
    private func editorSection(
        _ section: TasksNativeQuickEntryContract.LayoutSectionID
    ) -> some View {
        switch section {
        case .summary:
            summaryField
        case .temporal:
            temporalFields
        case .identity:
            identityFields
        case .optional:
            optionalMetadataFields
            optionalAdditions
        }
    }

    private var header: some View {
        HStack {
            Button(action: model.cancel) {
                Image(systemName: "xmark")
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel")

            Spacer()
            Text("New Task")
                .font(.headline)
            Spacer()

            Color.clear.frame(width: 28, height: 28)
        }
        .padding(.horizontal, 14)
        .frame(height: TasksMacQuickEntryPanelPolicy.dragRegionHeight)
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    private var summaryField: some View {
        TextField("Summary", text: $model.draft.summary)
            .textFieldStyle(TasksNativeQuickEntryTextFieldStyle())
            .focused($focusedField, equals: .summary)
            .onSubmit(model.save)
            .accessibilityLabel("Summary")
    }

    @ViewBuilder
    private var optionalMetadataFields: some View {
        if model.draft.showsNotes || !model.draft.notes.isEmpty {
            ZStack(alignment: .topLeading) {
                if model.draft.notes.isEmpty {
                    Text("Notes")
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 9)
                }
                TextEditor(text: $model.draft.notes)
                    .scrollContentBackground(.hidden)
                    .padding(4)
                    .frame(minHeight: 76)
                    .focused($focusedField, equals: .notes)
            }
            .background(TasksNativeQuickEntryControlBackground())
        }

        if model.draft.showsLink || !model.draft.link.isEmpty {
            TextField("Link", text: $model.draft.link)
                .textFieldStyle(TasksNativeQuickEntryTextFieldStyle())
                .focused($focusedField, equals: .link)
                .accessibilityLabel("Link")
        }

        if model.draft.showsChecklist || !model.draft.checklist.isEmpty {
            VStack(spacing: 6) {
                ForEach($model.draft.checklist) { $item in
                    HStack(spacing: 8) {
                        Image(systemName: "square")
                            .foregroundStyle(.secondary)
                        TextField("Item", text: $item.title)
                            .textFieldStyle(TasksNativeQuickEntryTextFieldStyle())
                            .focused($focusedField, equals: .checklist(item.id))
                            .onSubmit {
                                _ = model.draft.insertChecklistItem(after: item.id)
                            }
                        Button {
                            model.draft.removeChecklistItem(id: item.id)
                        } label: {
                            Image(systemName: "xmark")
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Delete Checklist Item")
                        Image(systemName: "line.3.horizontal")
                            .foregroundStyle(.secondary)
                            .contentShape(Rectangle())
                            .onDrag {
                                draggedChecklistItemID = item.id
                                return NSItemProvider(
                                    object: item.id.uuidString as NSString
                                )
                            }
                            .accessibilityLabel("Reorder Checklist Item")
                    }
                    .onDrop(
                        of: [UTType.text],
                        delegate: TasksNativeQuickEntryChecklistDropDelegate(
                            targetID: item.id,
                            model: model,
                            draggedID: $draggedChecklistItemID
                        )
                    )
                }
            }
        }
    }

    private var temporalFields: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                startButton
                deadlineButton
            }
            if model.draft.reminderLocalTime != nil {
                reminderField
            }
        }
    }

    private var identityFields: some View {
        HStack(spacing: 10) {
            areaPicker
            actionabilityPicker
        }
    }

    private var startButton: some View {
        Button {
            showsDeadlinePicker = false
            showsStartPicker.toggle()
        } label: {
            TasksNativeQuickEntryFieldLabel(
                systemImage: "tray",
                text: startLabel,
                accent: .green
            )
        }
        .buttonStyle(TasksNativeQuickEntryFieldButtonStyle())
        .focused($focusedField, equals: .start)
    }

    private var deadlineButton: some View {
        Button {
            showsStartPicker = false
            showsDeadlinePicker.toggle()
        } label: {
            TasksNativeQuickEntryFieldLabel(
                systemImage: "flag",
                text: model.draft.deadlineDate?.displayText ?? "Deadline"
            )
        }
        .buttonStyle(TasksNativeQuickEntryFieldButtonStyle())
        .focused($focusedField, equals: .deadline)
    }

    @ViewBuilder
    private var calendarLayer: some View {
        if showsStartPicker || showsDeadlinePicker {
            ZStack {
                Color.black.opacity(0.45)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        showsStartPicker = false
                        showsDeadlinePicker = false
                    }

                Group {
                    if showsStartPicker {
                        startPicker
                    } else {
                        deadlinePicker
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(nsColor: TasksMacAppearance.applicationBackground))
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                }
            }
            .zIndex(10)
        }
    }

    private var areaPicker: some View {
        Picker("Area", selection: $model.draft.areaID) {
            Text("No Area").tag(UUID?.none)
            ForEach(model.areas) { area in
                Text(area.name).tag(Optional(area.id))
            }
        }
        .labelsHidden()
        .pickerStyle(.menu)
        .frame(maxWidth: .infinity)
        .focused($focusedField, equals: .area)
        .accessibilityLabel("Area")
    }

    private var actionabilityPicker: some View {
        Picker("Actionability", selection: $model.draft.actionability) {
            ForEach(TasksNativeQuickEntryContract.actionabilities, id: \.value) { option in
                Text(option.label).tag(option.value)
            }
        }
        .labelsHidden()
        .pickerStyle(.menu)
        .frame(maxWidth: .infinity)
        .focused($focusedField, equals: .actionability)
        .accessibilityLabel("Actionability")
    }

    private var reminderField: some View {
        HStack {
            Image(systemName: "bell")
                .foregroundStyle(.secondary)
            DatePicker(
                "Reminder",
                selection: reminderTimeBinding,
                displayedComponents: .hourAndMinute
            )
            .labelsHidden()
            .focused($focusedField, equals: .reminder)
            .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                model.draft.reminderLocalTime = nil
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Clear Reminder")
        }
        .padding(.horizontal, 10)
        .frame(height: 40)
        .background(TasksNativeQuickEntryControlBackground())
    }

    @ViewBuilder
    private var optionalAdditions: some View {
        let additions = availableAdditions
        if !additions.isEmpty {
            HStack(spacing: 8) {
                ForEach(additions, id: \.0) { addition in
                    Button(addition.0, action: addition.2)
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity)
                        .focused($focusedField, equals: addition.1)
                }
            }
        }
    }

    @ViewBuilder
    private var submissionError: some View {
        if case let .failed(message) = model.draft.submissionState {
            Text(message)
                .font(.footnote)
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var footer: some View {
        HStack {
            Spacer()
            Button("Cancel", action: model.cancel)
                .buttonStyle(.bordered)
                .focused($focusedField, equals: .cancel)
            Button(action: model.save) {
                if model.draft.submissionState == .submitting {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text("Save")
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.white)
            .foregroundStyle(.black)
            .focused($focusedField, equals: .save)
            .keyboardShortcut(.return, modifiers: .command)
            .disabled(!model.canSave)
        }
        .padding(.horizontal, 20)
        .frame(height: 58)
        .overlay(alignment: .top) {
            Divider()
        }
    }

    private var startPicker: some View {
        VStack(spacing: 10) {
            HStack {
                ForEach(TasksNativeQuickEntryContract.todaySections, id: \.value) { option in
                    Button(option.label) {
                        model.draft.setTodaySection(option.value)
                        showsStartPicker = false
                    }
                    .buttonStyle(.bordered)
                }
            }
            DatePicker(
                "Start",
                selection: startDateBinding,
                in: (model.planningDate.date() ?? Date())...,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            HStack {
                Button("Clear") {
                    model.draft.clearStart()
                    showsStartPicker = false
                }
                Button("Someday") {
                    model.draft.setSomeday()
                    showsStartPicker = false
                }
            }
            if model.draft.hasStart {
                Divider()
                if model.draft.reminderLocalTime == nil {
                    Button("Add Reminder") {
                        model.draft.reminderLocalTime = "09:00"
                        model.draft.focus = .reminder
                        showsStartPicker = false
                    }
                } else {
                    HStack {
                        Image(systemName: "bell")
                            .foregroundStyle(.secondary)
                        DatePicker(
                            "Reminder",
                            selection: reminderTimeBinding,
                            displayedComponents: .hourAndMinute
                        )
                        .labelsHidden()
                        Button("Clear") {
                            model.draft.reminderLocalTime = nil
                        }
                    }
                }
            }
        }
        .padding(14)
        .frame(width: 340)
    }

    private var deadlinePicker: some View {
        VStack(spacing: 10) {
            DatePicker(
                "Deadline",
                selection: deadlineDateBinding,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            Button("Clear") {
                model.draft.deadlineDate = nil
                showsDeadlinePicker = false
            }
        }
        .padding(14)
        .frame(width: 320)
    }

    private var startDateBinding: Binding<Date> {
        Binding(
            get: {
                model.draft.startDate?.date()
                    ?? model.planningDate.date()
                    ?? Date()
            },
            set: {
                model.draft.setExplicitStart(.init($0))
            }
        )
    }

    private var deadlineDateBinding: Binding<Date> {
        Binding(
            get: { model.draft.deadlineDate?.date() ?? Date() },
            set: { model.draft.deadlineDate = .init($0) }
        )
    }

    private var reminderTimeBinding: Binding<Date> {
        Binding(
            get: {
                Self.reminderDate(from: model.draft.reminderLocalTime)
                    ?? Self.reminderDate(from: "09:00")
                    ?? Date()
            },
            set: { value in
                let components = Calendar.current.dateComponents(
                    [.hour, .minute],
                    from: value
                )
                model.draft.reminderLocalTime = String(
                    format: "%02d:%02d",
                    components.hour ?? 0,
                    components.minute ?? 0
                )
            }
        )
    }

    private static func reminderDate(from value: String?) -> Date? {
        guard let value else { return nil }
        let pieces = value.split(separator: ":", omittingEmptySubsequences: false)
        guard
            pieces.count == 2,
            let hour = Int(pieces[0]),
            let minute = Int(pieces[1]),
            (0...23).contains(hour),
            (0...59).contains(minute)
        else {
            return nil
        }
        return Calendar.current.date(
            bySettingHour: hour,
            minute: minute,
            second: 0,
            of: Date()
        )
    }

    private var startLabel: String {
        if model.draft.destination == "someday" {
            return "Someday"
        }
        if let startDate = model.draft.startDate {
            return startDate.displayText
        }
        if let todaySection = model.draft.todaySection,
           let option = TasksNativeQuickEntryContract.todaySections.first(where: {
               $0.value == todaySection
           }) {
            return "Today · \(option.label)"
        }
        return "Start"
    }

    private var availableAdditions: [(
        String,
        TasksNativeQuickEntryFocusTarget,
        () -> Void
    )] {
        var additions: [(
            String,
            TasksNativeQuickEntryFocusTarget,
            () -> Void
        )] = []
        if !model.draft.showsNotes && model.draft.notes.isEmpty {
            additions.append(("+ Notes", .notes, {
                model.draft.showsNotes = true
                model.draft.focus = .notes
            }))
        }
        if !model.draft.showsLink && model.draft.link.isEmpty {
            additions.append(("+ Link", .link, {
                model.draft.showsLink = true
                model.draft.focus = .link
            }))
        }
        if !model.draft.showsChecklist && model.draft.checklist.isEmpty {
            additions.append(("+ Checklist", .checklistDisclosure, {
                model.draft.appendChecklistItem()
            }))
        }
        return additions
    }
}

private struct TasksNativeQuickEntryChecklistDropDelegate: DropDelegate {
    let targetID: UUID
    let model: TasksNativeQuickEntryViewModel
    @Binding var draggedID: UUID?

    func dropEntered(info: DropInfo) {
        guard
            let draggedID,
            draggedID != targetID,
            let source = model.draft.checklist.firstIndex(where: { $0.id == draggedID }),
            let target = model.draft.checklist.firstIndex(where: { $0.id == targetID })
        else { return }

        withAnimation(.easeInOut(duration: 0.12)) {
            model.draft.moveChecklistItems(
                fromOffsets: IndexSet(integer: source),
                toOffset: target > source ? target + 1 : target
            )
        }
    }

    func performDrop(info: DropInfo) -> Bool {
        draggedID = nil
        return true
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }
}

private struct TasksNativeQuickEntryFieldLabel: View {
    let systemImage: String
    let text: String
    var accent: Color = .secondary

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(accent)
            Text(text)
                .lineLimit(1)
            Spacer()
        }
    }
}

private struct TasksNativeQuickEntryFieldButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: 40)
            .background(TasksNativeQuickEntryControlBackground())
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

private struct TasksNativeQuickEntryTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .textFieldStyle(.plain)
            .padding(.horizontal, 10)
            .frame(height: 40)
            .background(TasksNativeQuickEntryControlBackground())
    }
}

private struct TasksNativeQuickEntryControlBackground: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(Color(nsColor: .controlBackgroundColor))
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
            }
    }
}

private extension TasksNativeCalendarDate {
    var displayText: String {
        guard let date = date() else { return iso8601 }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy MMM d"
        return formatter.string(from: date)
    }
}
