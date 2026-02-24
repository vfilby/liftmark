import SwiftUI

struct ExercisePickerView: View {
    @State private var searchText = ""
    @Environment(\.dismiss) private var dismiss
    let onSelect: (String) -> Void

    private let commonExercises = [
        "Squat", "Deadlift", "Bench Press", "Overhead Press",
        "Barbell Row", "Pull-Up", "Dip", "Leg Press",
        "Romanian Deadlift", "Front Squat", "Incline Bench Press",
        "Lat Pulldown", "Cable Row", "Leg Curl", "Leg Extension",
        "Lateral Raise", "Bicep Curl", "Tricep Pushdown"
    ]

    private var filteredExercises: [String] {
        if searchText.isEmpty { return commonExercises }
        return commonExercises.filter { $0.localizedCaseInsensitiveContains(searchText) }
    }

    private var hasExactMatch: Bool {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return filteredExercises.contains { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .accessibilityIdentifier("exercise-picker-cancel")

                Spacer()

                Text("Choose Exercise")
                    .font(.headline)

                Spacer()
            }
            .padding()

            // Search
            TextField("Search exercises...", text: $searchText)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)
                .accessibilityIdentifier("exercise-picker-search")

            // List
            List {
                if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !hasExactMatch {
                    Button {
                        onSelect(searchText.trimmingCharacters(in: .whitespacesAndNewlines))
                        dismiss()
                    } label: {
                        Label("Add \"\(searchText.trimmingCharacters(in: .whitespacesAndNewlines))\"", systemImage: "plus.circle")
                    }
                    .accessibilityIdentifier("exercise-picker-free-entry")
                }

                ForEach(filteredExercises, id: \.self) { name in
                    Button(name) {
                        onSelect(name)
                        dismiss()
                    }
                    .accessibilityIdentifier("exercise-option-\(name)")
                }
            }
            .listStyle(.plain)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("exercise-picker-modal")
    }
}
