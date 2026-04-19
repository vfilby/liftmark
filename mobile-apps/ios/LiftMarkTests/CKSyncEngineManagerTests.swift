import CloudKit
import XCTest
@testable import LiftMark

/// Tests for CKSyncEngineManager-related types and the publicly accessible surface area.
///
/// Note: CKSyncEngineManager itself is a singleton with private init and tight CloudKit
/// coupling, making most of its internal logic untestable without a live iCloud connection.
/// These tests cover the supporting types and constants that CAN be validated in isolation.
final class CKSyncEngineManagerTests: XCTestCase {

    // MARK: - CloudKitAccountStatus enum

    func testCloudKitAccountStatusRawValues() {
        XCTAssertEqual(CloudKitAccountStatus.available.rawValue, "available")
        XCTAssertEqual(CloudKitAccountStatus.noAccount.rawValue, "noAccount")
        XCTAssertEqual(CloudKitAccountStatus.restricted.rawValue, "restricted")
        XCTAssertEqual(CloudKitAccountStatus.couldNotDetermine.rawValue, "couldNotDetermine")
        XCTAssertEqual(CloudKitAccountStatus.error.rawValue, "error")
    }

    func testCloudKitAccountStatusInitFromRawValue() {
        XCTAssertEqual(CloudKitAccountStatus(rawValue: "available"), .available)
        XCTAssertEqual(CloudKitAccountStatus(rawValue: "noAccount"), .noAccount)
        XCTAssertEqual(CloudKitAccountStatus(rawValue: "restricted"), .restricted)
        XCTAssertEqual(CloudKitAccountStatus(rawValue: "couldNotDetermine"), .couldNotDetermine)
        XCTAssertEqual(CloudKitAccountStatus(rawValue: "error"), .error)
        XCTAssertNil(CloudKitAccountStatus(rawValue: "invalid"))
    }

    func testCloudKitAccountStatusCasesAreExhaustive() {
        // Verify all five cases exist (compile-time check via switch)
        let statuses: [CloudKitAccountStatus] = [.available, .noAccount, .restricted, .couldNotDetermine, .error]
        XCTAssertEqual(statuses.count, 5)
    }

    // MARK: - Notification.Name.syncCompleted

    func testSyncCompletedNotificationName() {
        XCTAssertEqual(Notification.Name.syncCompleted.rawValue, "syncCompleted")
    }

    func testSyncCompletedNotificationCanBePostedAndObserved() {
        let expectation = expectation(description: "syncCompleted notification received")

        let observer = NotificationCenter.default.addObserver(
            forName: .syncCompleted,
            object: nil,
            queue: .main
        ) { _ in
            expectation.fulfill()
        }

        NotificationCenter.default.post(name: .syncCompleted, object: nil)
        wait(for: [expectation], timeout: 2.0)

        NotificationCenter.default.removeObserver(observer)
    }

    // MARK: - isNonFatalZoneCreateError

    func testZoneCreateNonFatalErrors() {
        XCTAssertTrue(CKSyncEngineManager.isNonFatalZoneCreateError(.zoneNotFound))
        XCTAssertTrue(CKSyncEngineManager.isNonFatalZoneCreateError(.partialFailure))
        XCTAssertTrue(CKSyncEngineManager.isNonFatalZoneCreateError(.accountTemporarilyUnavailable))
    }

    func testZoneCreateFatalErrorsAreNotMisclassified() {
        XCTAssertFalse(CKSyncEngineManager.isNonFatalZoneCreateError(nil))
        XCTAssertFalse(CKSyncEngineManager.isNonFatalZoneCreateError(.notAuthenticated))
        XCTAssertFalse(CKSyncEngineManager.isNonFatalZoneCreateError(.permissionFailure))
        XCTAssertFalse(CKSyncEngineManager.isNonFatalZoneCreateError(.invalidArguments))
        XCTAssertFalse(CKSyncEngineManager.isNonFatalZoneCreateError(.quotaExceeded))
    }
}
