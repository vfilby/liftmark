Pod::Spec.new do |s|
  s.name           = 'ExpoCloudKit'
  s.version        = '1.0.0'
  s.summary        = 'A simple Expo module for CloudKit integration'
  s.description    = 'A simple Expo module for CloudKit integration'
  s.author         = 'Expo Team <expo-team@expo.dev>'
  s.homepage       = 'https://github.com/expo/expo'
  s.platforms      = { :ios => '13.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end