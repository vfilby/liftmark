import SwiftUI

struct ExercisePickerView: View {
    @State private var searchText = ""
    @Environment(\.dismiss) private var dismiss
    let onSelect: (String) -> Void

    private let commonExercises = [
        "Bench Press", "Squat", "Deadlift", "Overhead Press",
        "Barbell Row", "Pull-Up", "Lat Pulldown", "Dumbbell Curl",
        "Tricep Extension", "Leg Press", "Leg Curl", "Leg Extension",
        "Cable Fly", "Face Pull", "Lateral Raise"
    ]

    private var filteredExercises: [String] {
        if searchText.isEmpty { return commonExercises }
        return commonExercises.filter { $0.localizedCaseInsensitiveContains(searchText) }
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
                if !searchText.isEmpty {
                    Button {
                        onSelect(searchText)
                        dismiss()
                    } label: {
                        Label("Use \"\(searchText)\"", systemImage: "plus.circle")
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
        .accessibilityIdentifier("exercise-picker-modal")
    }
}
