.PHONY: build test clean resolve

resolve:
	swift package resolve

build:
	xcodebuild -scheme LiftMark -destination 'platform=iOS Simulator,name=iPhone 15'

test:
	xcodebuild test -scheme LiftMark -destination 'platform=iOS Simulator,name=iPhone 15'

clean:
	xcodebuild clean -scheme LiftMark
	rm -rf .build
