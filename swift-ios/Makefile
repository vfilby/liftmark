.PHONY: build test clean resolve

DESTINATION = 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.2'

resolve:
	swift package resolve

build:
	xcodebuild -scheme LiftMark -project LiftMark.xcodeproj -destination $(DESTINATION) build

test:
	xcodebuild test -scheme LiftMark -project LiftMark.xcodeproj -destination $(DESTINATION)

clean:
	xcodebuild clean -scheme LiftMark
	rm -rf .build
