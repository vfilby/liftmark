import SwiftUI

struct DisclaimerText: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            disclaimerSection(
                title: "Tracking Only",
                body: "LiftMark is a workout tracking tool. It does not provide exercise instruction, form guidance, coaching, or medical advice. You are solely responsible for knowing how to safely perform any exercises you track."
            )

            disclaimerSection(
                title: "Assumption of Risk",
                body: "Strength training and physical exercise carry inherent risks including injury, disability, and in rare cases death. By using this app, you acknowledge these risks and accept full responsibility for your physical safety during workouts."
            )

            disclaimerSection(
                title: "Not Medical Advice",
                body: "Nothing in this app constitutes medical advice. Consult a qualified healthcare provider before starting any exercise program, especially if you have pre-existing health conditions."
            )

            disclaimerSection(
                title: "Younger Users",
                body: "If you are under 18, we recommend working with a parent, guardian, or qualified fitness professional when performing strength training exercises."
            )

            disclaimerSection(
                title: "No Warranty",
                body: "This app is provided as-is. The developers are not liable for any injury, loss, or damage arising from the use of this app or reliance on any data it records."
            )
        }
    }

    private func disclaimerSection(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(body)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
