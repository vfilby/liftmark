import SwiftUI

struct WorkoutsView: View {
    @Environment(WorkoutPlanStore.self) private var planStore
    @Environment(GymStore.self) private var gymStore
    @Environment(EquipmentStore.self) private var equipmentStore

    @State private var searchText = ""
    @State private var showFavoritesOnly = false
    @State private var showEquipmentFilter = false
    @State private var showFilters = false
    @State private var selectedGymId: String?
    @State private var showImport = false

    private var filteredPlans: [WorkoutPlan] {
        planStore.plans.filter { plan in
            let matchesSearch = searchText.isEmpty || plan.name.localizedCaseInsensitiveContains(searchText)
            let matchesFavorite = !showFavoritesOnly || plan.isFavorite
            let matchesEquipment = !showEquipmentFilter || planMatchesEquipment(plan)
            return matchesSearch && matchesFavorite && matchesEquipment
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            TextField("Search plans...", text: $searchText)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)
                .padding(.vertical, LiftMarkTheme.spacingSM)
                .accessibilityIdentifier("search-input")

            // Filter toggle
            Button {
                withAnimation { showFilters.toggle() }
            } label: {
                HStack {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                    Text("Filters")
                        .font(.subheadline)
                    if showFavoritesOnly || showEquipmentFilter {
                        Text("Active")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(LiftMarkTheme.primary.opacity(0.15))
                            .clipShape(Capsule())
                    }
                    Spacer()
                    Image(systemName: showFilters ? "chevron.up" : "chevron.down")
                        .font(.caption)
                }
                .foregroundStyle(LiftMarkTheme.label)
            }
            .padding(.horizontal)
            .padding(.bottom, LiftMarkTheme.spacingXS)
            .accessibilityIdentifier("filter-toggle")

            // Filter panel
            if showFilters {
                VStack(spacing: LiftMarkTheme.spacingSM) {
                    Toggle(isOn: $showFavoritesOnly) {
                        Label("Favorites Only", systemImage: "heart.fill")
                            .font(.subheadline)
                    }
                    .accessibilityIdentifier("switch-filter-favorites")

                    Toggle(isOn: $showEquipmentFilter) {
                        Label("Filter by Equipment", systemImage: "dumbbell")
                            .font(.subheadline)
                    }
                    .accessibilityIdentifier("switch-filter-equipment")
                    .onChange(of: showEquipmentFilter) {
                        if showEquipmentFilter, let defaultGym = gymStore.gyms.first(where: { $0.isDefault }) {
                            selectedGymId = defaultGym.id
                            equipmentStore.loadEquipment(forGym: defaultGym.id)
                        }
                    }

                    if showEquipmentFilter {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: LiftMarkTheme.spacingSM) {
                                ForEach(gymStore.gyms) { gym in
                                    Button {
                                        selectedGymId = gym.id
                                        equipmentStore.loadEquipment(forGym: gym.id)
                                    } label: {
                                        Text(gym.name)
                                            .font(.caption)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(selectedGymId == gym.id ? LiftMarkTheme.primary : LiftMarkTheme.secondaryBackground)
                                            .foregroundStyle(selectedGymId == gym.id ? .white : LiftMarkTheme.label)
                                            .clipShape(Capsule())
                                    }
                                    .accessibilityIdentifier("gym-option-\(gym.id)")
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, LiftMarkTheme.spacingSM)
            }

            Divider()

            // Plans list
            if filteredPlans.isEmpty {
                VStack(spacing: LiftMarkTheme.spacingMD) {
                    Spacer()
                    Image(systemName: "doc.on.clipboard")
                        .font(.system(size: 48))
                        .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                    Text("No Plans")
                        .font(.headline)
                    Text(emptyStateMessage)
                        .font(.subheadline)
                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                        .multilineTextAlignment(.center)

                    if !showEquipmentFilter {
                        Button("Import Plan") {
                            showImport = true
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("button-import-empty")
                    } else {
                        NavigationLink(value: AppDestination.gymDetail(id: selectedGymId ?? "")) {
                            Text("Set Up Equipment")
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("button-setup-equipment")
                    }

                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("empty-state")
            } else {
                List {
                    ForEach(Array(filteredPlans.enumerated()), id: \.element.id) { index, plan in
                        NavigationLink(value: AppDestination.workoutDetail(id: plan.id)) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(spacing: LiftMarkTheme.spacingXS) {
                                        Text(plan.name)
                                            .font(.headline)
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
                            }
                        }
                        .accessibilityIdentifier("workout-card-\(plan.id)")
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                planStore.deletePlan(id: plan.id)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                            .accessibilityIdentifier("delete-\(plan.id)")
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                planStore.toggleFavorite(id: plan.id)
                            } label: {
                                Label(
                                    plan.isFavorite ? "Unfavorite" : "Favorite",
                                    systemImage: plan.isFavorite ? "heart.slash" : "heart.fill"
                                )
                            }
                            .tint(.pink)
                            .accessibilityIdentifier("favorite-\(plan.id)")
                        }
                    }
                }
                .listStyle(.plain)
                .accessibilityIdentifier("workout-list")
            }
        }
        .accessibilityIdentifier("workouts-screen")
        .navigationTitle("Plans")
        .sheet(isPresented: $showImport) {
            ImportView()
        }
        .navigationDestination(for: AppDestination.self) { destination in
            switch destination {
            case .workoutDetail(let id):
                WorkoutDetailView(planId: id)
            case .gymDetail(let id):
                GymDetailView(gymId: id)
            default:
                EmptyView()
            }
        }
    }

    private var emptyStateMessage: String {
        if showEquipmentFilter {
            return "No plans match your available equipment. Update your gym setup."
        } else if showFavoritesOnly {
            return "No favorite plans yet. Swipe right on a plan to favorite it."
        } else if !searchText.isEmpty {
            return "No plans match \"\(searchText)\"."
        }
        return "Create a workout plan to get started."
    }

    private func planMatchesEquipment(_ plan: WorkoutPlan) -> Bool {
        let availableEquipment = Set(equipmentStore.equipment.filter(\.isAvailable).map { $0.name.lowercased() })
        guard !availableEquipment.isEmpty else { return true }
        for exercise in plan.exercises {
            if let eq = exercise.equipmentType, !availableEquipment.contains(eq.lowercased()) {
                return false
            }
        }
        return true
    }
}
