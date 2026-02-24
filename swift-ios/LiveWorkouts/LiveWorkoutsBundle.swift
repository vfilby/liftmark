//
//  LiveWorkoutsBundle.swift
//  LiveWorkouts
//
//  Created by Vincent Filby on 2/23/26.
//

import WidgetKit
import SwiftUI

@main
struct LiveWorkoutsBundle: WidgetBundle {
    var body: some Widget {
        LiveWorkouts()
        LiveWorkoutsControl()
        LiveWorkoutsLiveActivity()
    }
}
