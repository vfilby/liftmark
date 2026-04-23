import SwiftUI

struct OnboardingView: View {
    let onAccept: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 24) {
                    // App icon and welcome
                    VStack(spacing: 8) {
                        Image(systemName: "dumbbell.fill")
                            .font(.system(size: 50))
                            .foregroundStyle(.tint)

                        Text("Welcome to LiftMark")
                            .font(.title.weight(.bold))

                        Text("Markdown workouts you own")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 48)

                    // Brief explanation
                    Text(
                        "LiftMark keeps your workout plans as plain markdown — files you can read, edit, and share. "
                        + "Log your sets during sessions and keep a portable history of your training, "
                        + "ready for any text editor or AI assistant."
                    )
                        .font(.body)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)

                    // Disclaimer card
                    DisclaimerText()
                        .padding()
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)

                    // Accept button inside scroll content
                    Button {
                        onAccept()
                    } label: {
                        Text("I Understand")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("onboarding-accept-button")
                    .padding(.horizontal)
                    .padding(.bottom, 32)
                }
            }
        }
        .frame(maxWidth: 500)
        .accessibilityIdentifier("onboarding-screen")
    }
}
