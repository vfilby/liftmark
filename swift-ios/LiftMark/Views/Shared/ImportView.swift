import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct ImportView: View {
    var initialContent: String = ""

    @State private var markdownText = ""
    @State private var parseResult: ParseResult?
    @State private var parseError: String?
    @State private var isGenerating = false
    @State private var showImportSuccess = false
    @State private var importedPlanName = ""
    @State private var showDiscardConfirm = false
    @Environment(\.dismiss) private var dismiss
    @Environment(WorkoutPlanStore.self) private var planStore
    @Environment(SettingsStore.self) private var settingsStore

    private var canImport: Bool {
        !markdownText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && parseError == nil
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Action buttons
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: LiftMarkTheme.spacingSM) {
                        Button {
                            pasteFromClipboard()
                        } label: {
                            Label("Paste", systemImage: "doc.on.clipboard")
                                .font(.subheadline)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("button-paste")

                        Button {
                            copyPromptToClipboard()
                        } label: {
                            Label("Copy Prompt", systemImage: "doc.on.doc")
                                .font(.subheadline)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("button-copy-prompt")

                        if settingsStore.settings?.anthropicApiKeyStatus == .verified {
                            Button {
                                generateWorkout()
                            } label: {
                                if isGenerating {
                                    ProgressView()
                                        .controlSize(.small)
                                } else {
                                    Label("Generate", systemImage: "sparkles")
                                        .font(.subheadline)
                                }
                            }
                            .buttonStyle(.bordered)
                            .disabled(isGenerating)
                            .accessibilityIdentifier("button-generate")
                        }

                        if settingsStore.settings?.showOpenInClaudeButton == true {
                            Button {
                                openInClaude()
                            } label: {
                                Label("Open Claude", systemImage: "arrow.up.right.square")
                                    .font(.subheadline)
                            }
                            .buttonStyle(.bordered)
                            .accessibilityIdentifier("button-open-claude")
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, LiftMarkTheme.spacingSM)
                }

                Divider()

                // Markdown input
                TextEditor(text: $markdownText)
                    .font(.system(.body, design: .monospaced))
                    .padding(LiftMarkTheme.spacingSM)
                    .accessibilityIdentifier("input-markdown")
                    .overlay(
                        Group {
                            if markdownText.isEmpty {
                                VStack(alignment: .leading, spacing: LiftMarkTheme.spacingSM) {
                                    Text("Paste your workout in LiftMark format:")
                                        .foregroundStyle(LiftMarkTheme.secondaryLabel)
                                    Text("""
                                    # Push Day
                                    @tags: strength, upper
                                    @units: lbs

                                    ## Bench Press [barbell]
                                    - 135 x 5
                                    - 185 x 5
                                    - 225 x 5
                                    """)
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundStyle(LiftMarkTheme.tertiaryLabel)
                                }
                                .padding(LiftMarkTheme.spacingMD)
                                .allowsHitTesting(false)
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                            }
                        }
                    )

                // Parse result / error
                if let error = parseError {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(LiftMarkTheme.destructive)
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.destructive)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, LiftMarkTheme.spacingSM)
                    .background(LiftMarkTheme.destructive.opacity(0.1))
                }

                if let result = parseResult {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(LiftMarkTheme.success)
                        Text("\(result.name) - \(result.exerciseCount) exercises, \(result.setCount) sets")
                            .font(.caption)
                            .foregroundStyle(LiftMarkTheme.success)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, LiftMarkTheme.spacingSM)
                    .background(LiftMarkTheme.success.opacity(0.1))

                    if !result.warnings.isEmpty {
                        VStack(alignment: .leading, spacing: 2) {
                            ForEach(result.warnings, id: \.self) { warning in
                                HStack(spacing: 4) {
                                    Image(systemName: "exclamationmark.triangle")
                                        .font(.caption2)
                                        .foregroundStyle(LiftMarkTheme.warning)
                                    Text(warning)
                                        .font(.caption2)
                                        .foregroundStyle(LiftMarkTheme.warning)
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, LiftMarkTheme.spacingXS)
                    }
                }
            }
            .navigationTitle("Import Workout")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        if markdownText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            dismiss()
                        } else {
                            showDiscardConfirm = true
                        }
                    }
                    .accessibilityIdentifier("button-cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Import") {
                        importWorkout()
                    }
                    .disabled(!canImport)
                    .accessibilityIdentifier("button-import")
                }
            }
            .onChange(of: markdownText) {
                parseMarkdown()
            }
            .alert("Discard Changes?", isPresented: $showDiscardConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Discard", role: .destructive) {
                    dismiss()
                }
            } message: {
                Text("You have unsaved changes that will be lost.")
            }
            .alert("Workout Imported", isPresented: $showImportSuccess) {
                Button("OK") {
                    dismiss()
                }
            } message: {
                Text("\(importedPlanName) has been imported successfully.")
            }
        }
        .accessibilityIdentifier("import-modal")
        .onAppear {
            if !initialContent.isEmpty {
                markdownText = initialContent
            }
        }
    }

    // MARK: - Actions

    private func pasteFromClipboard() {
        #if canImport(UIKit)
        if let text = UIPasteboard.general.string {
            markdownText = text
        }
        #endif
    }

    private func copyPromptToClipboard() {
        #if canImport(UIKit)
        let prompt = buildAIPrompt()
        UIPasteboard.general.string = prompt
        #endif
    }

    private func openInClaude() {
        copyPromptToClipboard()
        #if canImport(UIKit)
        if let url = URL(string: "https://claude.ai") {
            UIApplication.shared.open(url)
        }
        #endif
    }

    private func generateWorkout() {
        isGenerating = true
        Task {
            guard let apiKey = SecureStorage.getApiKey() else {
                isGenerating = false
                return
            }

            let context = WorkoutGenerationContext(
                defaultWeightUnit: settingsStore.settings?.defaultWeightUnit ?? .lbs,
                customPromptAddition: settingsStore.settings?.customPromptAddition,
                recentWorkouts: "",
                availableEquipment: [],
                currentGym: nil
            )
            let params = WorkoutGenerationParams(
                intent: "general workout"
            )
            let prompt = WorkoutGenerationService.buildWorkoutGenerationPrompt(context: context, params: params)
            let result = await AnthropicService.shared.generateWorkout(apiKey: apiKey, prompt: prompt)

            await MainActor.run {
                isGenerating = false
                if let workout = result.workout {
                    markdownText = workout
                } else if let error = result.error {
                    parseError = error.message
                }
            }
        }
    }

    private func parseMarkdown() {
        let trimmed = markdownText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            parseResult = nil
            parseError = nil
            return
        }

        let result = MarkdownParser.parseWorkout(trimmed)

        if !result.errors.isEmpty {
            parseError = result.errors.first ?? "Parse error"
            parseResult = nil
        } else {
            parseError = nil
            parseResult = ParseResult(
                name: result.data?.name ?? "Untitled",
                exerciseCount: result.data?.exercises.count ?? 0,
                setCount: result.data?.exercises.reduce(0) { $0 + $1.sets.count } ?? 0,
                warnings: result.warnings
            )
        }
    }

    private func importWorkout() {
        let result = MarkdownParser.parseWorkout(markdownText)
        guard var plan = result.data else { return }
        plan.sourceMarkdown = markdownText
        planStore.createPlan(plan)
        importedPlanName = plan.name
        showImportSuccess = true
    }

    private func buildAIPrompt() -> String {
        var prompt = "Generate a workout plan in LiftMark Workout Format (LMWF).\n\n"
        prompt += "Format example:\n"
        prompt += "# Workout Name\n@tags: tag1, tag2\n@units: lbs\n\n"
        prompt += "## Exercise Name [equipment]\n- weight x reps\n\n"

        if let addition = settingsStore.settings?.customPromptAddition, !addition.isEmpty {
            prompt += "Additional context: \(addition)\n"
        }
        return prompt
    }
}

// MARK: - Parse Result

private struct ParseResult {
    let name: String
    let exerciseCount: Int
    let setCount: Int
    let warnings: [String]
}
