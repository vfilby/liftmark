import XCTest
import CloudKit
import GRDB
@testable import LiftMark

/// Tests for CKSyncConflictResolver: error code naming, conflict tracking,
/// and deduplication logic.
final class CKSyncConflictResolverTests: XCTestCase {

    private var resolver: CKSyncConflictResolver!
    private var mapper: CKRecordMapper!

    override func setUp() {
        super.setUp()
        DatabaseManager.shared.deleteDatabase()
        _ = Logger.shared
        mapper = CKRecordMapper()
        resolver = CKSyncConflictResolver(mapper: mapper)
    }

    override func tearDown() {
        DatabaseManager.shared.deleteDatabase()
        super.tearDown()
    }

    // MARK: - errorCodeName

    func testErrorCodeNameReturnsCorrectNameForCommonCodes() {
        let cases: [(CKError.Code, String)] = [
            (.internalError, "internalError"),
            (.partialFailure, "partialFailure"),
            (.networkUnavailable, "networkUnavailable"),
            (.networkFailure, "networkFailure"),
            (.badContainer, "badContainer"),
            (.serviceUnavailable, "serviceUnavailable"),
            (.requestRateLimited, "requestRateLimited"),
            (.missingEntitlement, "missingEntitlement"),
            (.notAuthenticated, "notAuthenticated"),
            (.permissionFailure, "permissionFailure"),
            (.unknownItem, "unknownItem"),
            (.invalidArguments, "invalidArguments"),
            (.serverRecordChanged, "serverRecordChanged"),
            (.serverRejectedRequest, "serverRejectedRequest"),
            (.assetFileNotFound, "assetFileNotFound"),
            (.assetFileModified, "assetFileModified"),
            (.incompatibleVersion, "incompatibleVersion"),
            (.constraintViolation, "constraintViolation"),
            (.operationCancelled, "operationCancelled"),
            (.changeTokenExpired, "changeTokenExpired"),
            (.batchRequestFailed, "batchRequestFailed"),
            (.zoneBusy, "zoneBusy"),
            (.badDatabase, "badDatabase"),
            (.quotaExceeded, "quotaExceeded"),
            (.zoneNotFound, "zoneNotFound"),
            (.limitExceeded, "limitExceeded"),
            (.userDeletedZone, "userDeletedZone"),
            (.managedAccountRestricted, "managedAccountRestricted"),
            (.participantMayNeedVerification, "participantMayNeedVerification"),
            (.accountTemporarilyUnavailable, "accountTemporarilyUnavailable"),
        ]

        for (code, expectedName) in cases {
            let result = CKSyncConflictResolver.errorCodeName(code)
            XCTAssertEqual(result, expectedName, "errorCodeName for \(code.rawValue) should be \(expectedName)")
        }
    }

    func testErrorCodeNameReturnsDifferentNamesForDifferentCodes() {
        let name1 = CKSyncConflictResolver.errorCodeName(.networkFailure)
        let name2 = CKSyncConflictResolver.errorCodeName(.notAuthenticated)
        XCTAssertNotEqual(name1, name2)
    }

    func testErrorCodeNameNeverReturnsEmptyString() {
        // Test a handful of known codes to verify none return empty
        let codes: [CKError.Code] = [
            .internalError, .networkFailure, .quotaExceeded, .serverRecordChanged
        ]
        for code in codes {
            let name = CKSyncConflictResolver.errorCodeName(code)
            XCTAssertFalse(name.isEmpty, "errorCodeName should never be empty for code \(code.rawValue)")
        }
    }

    // MARK: - isConflictResolved (deduplication tracking)

    func testIsConflictResolvedReturnsFalseInitially() {
        XCTAssertFalse(resolver.isConflictResolved("some-record-id"))
    }

    func testIsConflictResolvedReturnsFalseForUnknownRecord() {
        // Even after some records might be resolved, unrelated ones should return false
        XCTAssertFalse(resolver.isConflictResolved("never-seen-record"))
        XCTAssertFalse(resolver.isConflictResolved(""))
    }

    func testIsConflictResolvedDistinguishesDifferentRecordNames() {
        // Without triggering actual conflicts, the resolver starts clean
        XCTAssertFalse(resolver.isConflictResolved("record-a"))
        XCTAssertFalse(resolver.isConflictResolved("record-b"))
    }

    // MARK: - Thread safety

    func testIsConflictResolvedIsThreadSafe() {
        // Call from multiple threads concurrently — should not crash
        let expectation = expectation(description: "concurrent access")
        expectation.expectedFulfillmentCount = 100

        for i in 0..<100 {
            DispatchQueue.global().async {
                _ = self.resolver.isConflictResolved("record-\(i)")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)
    }

    // MARK: - Fresh resolver state

    func testNewResolverHasNoResolvedConflicts() {
        // A freshly created resolver should have no resolved conflicts
        let freshResolver = CKSyncConflictResolver(mapper: mapper)
        for i in 0..<10 {
            XCTAssertFalse(freshResolver.isConflictResolved("id-\(i)"))
        }
    }
}
