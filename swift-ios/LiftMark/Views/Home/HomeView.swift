import SwiftUI

struct HomeView: View {
    @Environment(WorkoutPlanStore.self) private var planStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var showImport = false
    @State private var showExercisePicker = false
    @State private var editingTileIndex: Int?

    private var homeTiles: [String] {
        settingsStore.settings?.homeTiles ?? ["Squat", "Deadlift", "Bench Press", "Overhead Press"]
    }

    private var isRegularWidth: Bool {
        horizontalSizeClass == .regular
    }

    private var maxLiftColumns: [GridItem] {
        if isRegularWidth {
            return Array(repeating: GridItem(.flexible()), count: 4)
        } else {
            return [GridItem(.flexible()), GridItem(.flexible())]
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: LiftMarkTheme.spacingMD) {
                // Resume Workout Banner
                if let activeSession = sessionStore.activeSession {
                    NavigationLink(value: AppDestination.activeWorkout) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Resume \(activeSession.name)")
                                    .font(.headline)
                                Text(setProgressText(for: activeSession))
                                    .font(.subheadline)
                                    .opacity(0.9)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .frame(maxWidth: isRegularWidth ? nil : .infinity, alignment: .leading)
                        .padding()
                        .background(LiftMarkTheme.primary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                        .if(isRegularWidth) { view in
                            view.fixedSize(horizontal: true, vertical: false)
                        }
                    }
                    .accessibilityIdentifier("resume-workout-banner")
                }

                // Max Lifts Section
                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                    Text("Max Lifts")
                        .font(.headline)

                    LazyVGrid(columns: maxLiftColumns, spacing: LiftMarkTheme.spacingSM) {
                        ForEach(Array(homeTiles.enumerated()), id: \.offset) { index, exerciseName in
                            MaxLiftTile(
                                exerciseName: exerciseName,
                                maxWeight: findMaxWeight(for: exerciseName),
                                unit: settingsStore.settings?.defaultWeightUnit ?? .lbs,
                                isRegularWidth: isRegularWidth,
                                sparklineData: isRegularWidth ? findMaxWeightsPerSession(for: exerciseName) : [],
                                onLongPress: {
                                    editingTileIndex = index
                                    showExercisePicker = true
                                }
                            )
                            .accessibilityElement(children: .contain)
                            .accessibilityIdentifier("max-lift-tile-\(index)")
                        }
                    }
                }

                // Recent Plans Section
                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                    Text("Recent Plans")
                        .font(.headline)

                    if planStore.plans.isEmpty {
                        VStack(spacing: LiftMarkTheme.spacingSM) {
                            Image(systemName: "dumbbell")
                                .font(.largeTitle)
                                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                            Text("No plans yet")
                                .font(.headline)
                                .foregroundStyle(LiftMarkTheme.label)
                            Text("Import your first workout plan to get started")
                                .font(.subheadline)
                                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(LiftMarkTheme.spacingLG)
                        .accessibilityIdentifier("empty-state")
                    } else if isRegularWidth {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 280))], spacing: LiftMarkTheme.spacingSM) {
                            ForEach(planStore.plans.prefix(3)) { plan in
                                NavigationLink(value: AppDestination.workoutDetail(id: plan.id)) {
                                    WorkoutPlanCard(plan: plan)
                                }
                                .accessibilityIdentifier("workout-card-\(plan.id)")
                            }
                        }
                    } else {
                        ForEach(planStore.plans.prefix(3)) { plan in
                            NavigationLink(value: AppDestination.workoutDetail(id: plan.id)) {
                                WorkoutPlanCard(plan: plan)
                            }
                            .accessibilityIdentifier("workout-card-\(plan.id)")
                        }
                    }
                }
                .accessibilityIdentifier("recent-plans")

                // Create Plan Button (inside ScrollView, above tab bar)
                Button {
                    showImport = true
                } label: {
                    Label("Create Plan", systemImage: "plus")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(LiftMarkTheme.primary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
                }
                .accessibilityIdentifier("button-import-workout")
            }
            .padding()
            .frame(maxWidth: isRegularWidth ? 800 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("home-screen")
        .navigationTitle("LiftMark")
        .sheet(isPresented: $showImport) {
            ImportView()
        }
        .sheet(isPresented: $showExercisePicker) {
            ExercisePickerView { selectedExercise in
                if let index = editingTileIndex {
                    var tiles = homeTiles
                    if index < tiles.count {
                        tiles[index] = selectedExercise
                    }
                    if var settings = settingsStore.settings {
                        settings.homeTiles = tiles
                        settingsStore.updateSettings(settings)
                    }
                }
            }
        }
        .navigationDestination(for: AppDestination.self) { destination in
            switch destination {
            case .workoutDetail(let id):
                WorkoutDetailView(planId: id)
            case .activeWorkout:
                ActiveWorkoutView()
            case .workoutSummary:
                WorkoutSummaryView()
            default:
                EmptyView()
            }
        }
    }

    private func findMaxWeight(for exerciseName: String) -> Double? {
        // Search all completed sessions for global max weight on this exercise
        var globalMax: Double?
        for session in sessionStore.sessions {
            for exercise in session.exercises where exercise.exerciseName.lowercased() == exerciseName.lowercased() {
                let maxW = exercise.sets
                    .filter { $0.status == .completed }
                    .compactMap { $0.actualWeight }
                    .max()
                if let maxW {
                    globalMax = max(globalMax ?? 0, maxW)
                }
            }
        }
        return globalMax
    }

    private func findMaxWeightsPerSession(for exerciseName: String) -> [Double] {
        // Get completed sessions sorted by date, find max weight per session for this exercise
        let completedSessions = sessionStore.sessions
            .filter { $0.status == .completed }
            .sorted { $0.date < $1.date }

        var weights: [Double] = []
        for session in completedSessions {
            for exercise in session.exercises where exercise.exerciseName.lowercased() == exerciseName.lowercased() {
                if let maxW = exercise.sets
                    .filter({ $0.status == .completed })
                    .compactMap({ $0.actualWeight })
                    .max() {
                    weights.append(maxW)
                }
            }
        }
        return Array(weights.suffix(6))
    }

    private func setProgressText(for session: WorkoutSession) -> String {
        let totalSets = session.exercises.flatMap { $0.sets }.count
        let completedSets = session.exercises.flatMap { $0.sets }.filter { $0.status == .completed }.count
        return "\(completedSets)/\(totalSets) sets completed"
    }
}

// MARK: - Conditional View Modifier

private extension View {
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Sparkline View

private struct SparklineView: View {
    let values: [Double]

    private var trend: String {
        guard values.count >= 2 else { return "\u{2192}" }
        let last = values[values.count - 1]
        let previous = values[values.count - 2]
        let change = last - previous
        let threshold = previous * 0.02 // 2% threshold for flat
        if change > threshold {
            return "\u{2197}" // ↗
        } else if change < -threshold {
            return "\u{2198}" // ↘
        } else {
            return "\u{2192}" // →
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { geo in
                let width = geo.size.width
                let height: CGFloat = 32
                let minVal = values.min() ?? 0
                let maxVal = values.max() ?? 1
                let range = maxVal - minVal
                let safeRange = range == 0 ? 1.0 : range

                let points: [CGPoint] = values.enumerated().map { index, value in
                    let x = values.count > 1
                        ? width * CGFloat(index) / CGFloat(values.count - 1)
                        : width / 2
                    let y = height - (height * CGFloat(value - minVal) / CGFloat(safeRange))
                    return CGPoint(x: x, y: y)
                }

                ZStack {
                    // Filled area under the line
                    Path { path in
                        guard let first = points.first else { return }
                        path.move(to: CGPoint(x: first.x, y: height))
                        path.addLine(to: first)
                        for point in points.dropFirst() {
                            path.addLine(to: point)
                        }
                        if let last = points.last {
                            path.addLine(to: CGPoint(x: last.x, y: height))
                        }
                        path.closeSubpath()
                    }
                    .fill(LiftMarkTheme.primary.opacity(0.08))

                    // Line
                    Path { path in
                        guard let first = points.first else { return }
                        path.move(to: first)
                        for point in points.dropFirst() {
                            path.addLine(to: point)
                        }
                    }
                    .stroke(LiftMarkTheme.primary, lineWidth: 1.5)

                    // Rightmost dot
                    if let last = points.last {
                        Circle()
                            .fill(LiftMarkTheme.primary)
                            .frame(width: 5, height: 5)
                            .position(last)
                    }
                }
            }
            .frame(height: 32)

            // Label
            Text("\(values.count) sessions \(trend)")
                .font(.caption2)
                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
        }
    }
}

// MARK: - Max Lift Tile

private struct MaxLiftTile: View {
    let exerciseName: String
    let maxWeight: Double?
    let unit: WeightUnit
    let isRegularWidth: Bool
    let sparklineData: [Double]
    let onLongPress: () -> Void

    var body: some View {
        VStack(spacing: LiftMarkTheme.spacingXS) {
            Text(exerciseName)
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.secondaryLabel)
                .lineLimit(1)

            if let weight = maxWeight {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(formatWeight(weight))
                        .font(.title2.bold())
                    Text(unit.rawValue)
                        .font(.caption2)
                        .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                }
            } else {
                Text("\u{2014}")
                    .font(.title2.bold())
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                Text("No data yet")
                    .font(.caption2)
                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
            }

            if isRegularWidth && sparklineData.count >= 2 {
                SparklineView(values: sparklineData)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 80)
        .padding(LiftMarkTheme.spacingLG)
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
        .onLongPressGesture(minimumDuration: 0.4) {
            onLongPress()
        }
    }

    private func formatWeight(_ w: Double) -> String {
        w.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(w))" : String(format: "%.1f", w)
    }
}

// MARK: - Workout Plan Card

private struct WorkoutPlanCard: View {
    let plan: WorkoutPlan

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: LiftMarkTheme.spacingXS) {
                    Text(plan.name)
                        .font(.headline)
                        .foregroundStyle(LiftMarkTheme.label)
                    if plan.isFavorite {
                        Image(systemName: "heart.fill")
                            .font(.caption)
                            .foregroundStyle(.pink)
                    }
                }
                HStack(spacing: LiftMarkTheme.spacingSM) {
                    Text("\(plan.exercises.count) exercises")
                        .font(.subheadline)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                    if !plan.tags.isEmpty {
                        Text(plan.tags.prefix(2).joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    }
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(LiftMarkTheme.tertiaryLabel)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(LiftMarkTheme.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: LiftMarkTheme.cornerRadiusMD))
    }
}
