import ActivityKit
import WidgetKit
import SwiftUI

struct LiveWorkoutsLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            // Lock screen / banner UI
            HStack(spacing: 12) {
                // Exercise info
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.state.title)
                        .font(.headline)
                        .lineLimit(1)
                    Text(context.state.subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Rest timer countdown or progress
                if let timerEnd = context.state.timerEndDate {
                    Text(timerEnd, style: .timer)
                        .font(.title2.monospacedDigit().bold())
                        .foregroundStyle(.orange)
                } else {
                    Text("\(Int(context.state.progress * 100))%")
                        .font(.title2.bold())
                        .foregroundStyle(.blue)
                }
            }
            .padding()
            .activityBackgroundTint(.black.opacity(0.8))
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.title)
                            .font(.headline)
                            .lineLimit(1)
                        Text(context.state.subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let timerEnd = context.state.timerEndDate {
                        Text(timerEnd, style: .timer)
                            .font(.title3.monospacedDigit().bold())
                            .foregroundStyle(.orange)
                    } else {
                        Text("\(Int(context.state.progress * 100))%")
                            .font(.title3.bold())
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(value: context.state.progress)
                        .tint(.blue)
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill")
                    .foregroundStyle(.blue)
            } compactTrailing: {
                if let timerEnd = context.state.timerEndDate {
                    Text(timerEnd, style: .timer)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.orange)
                } else {
                    Text("\(Int(context.state.progress * 100))%")
                        .font(.caption.monospacedDigit())
                }
            } minimal: {
                Image(systemName: "dumbbell.fill")
                    .foregroundStyle(.blue)
            }
            .widgetURL(URL(string: "liftmark://workout"))
        }
    }
}

#Preview("Notification", as: .content, using: WorkoutActivityAttributes(workoutName: "Push Day")) {
    LiveWorkoutsLiveActivity()
} contentStates: {
    WorkoutActivityAttributes.ContentState(
        title: "Bench Press",
        subtitle: "Set 2/4 · 185 lbs × 5",
        progress: 0.35
    )
    WorkoutActivityAttributes.ContentState(
        title: "Rest",
        subtitle: "Next: Overhead Press",
        progress: 0.35,
        timerEndDate: Date().addingTimeInterval(90)
    )
}
