import SwiftUI

struct DisclaimerView: View {
    var body: some View {
        ScrollView {
            DisclaimerText()
                .padding()
        }
        .navigationTitle("Disclaimer")
    }
}
