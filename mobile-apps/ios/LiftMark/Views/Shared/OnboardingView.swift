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

                        Text("Your workout tracking companion")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 48)

                    // Brief explanation
                    Text("LiftMark helps you track your strength training workouts. Import workout plans, log your sets, reps, and weights during sessions, and review your progress over time.")
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
