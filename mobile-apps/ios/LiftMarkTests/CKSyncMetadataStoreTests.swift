import XCTest
import GRDB
@testable import LiftMark

/// Tests for CKSyncMetadataStore: sync-enabled flag, last sync date, and stats persistence.
final class CKSyncMetadataStoreTests: XCTestCase {

    private var store: CKSyncMetadataStore!

    override func setUp() {
        super.setUp()
        DatabaseManager.shared.deleteDatabase()
        _ = Logger.shared
        store = CKSyncMetadataStore()
    }

    override func tearDown() {
        DatabaseManager.shared.deleteDatabase()
        super.tearDown()
    }

    // MARK: - Helpers

    private func dbQueue() throws -> DatabaseQueue {
        try DatabaseManager.shared.database()
    }

    private func rowCount() throws -> Int {
        let db = try dbQueue()
        return try db.read { try Int.fetchOne($0, sql: "SELECT COUNT(*) FROM sync_metadata") ?? 0 }
    }

    // MARK: - getSyncEnabled

    func testGetSyncEnabledReturnsTrueByDefault() {
        // No row exists yet — default should be true
        XCTAssertTrue(store.getSyncEnabled())
    }

    func testSetSyncEnabledPersistsAndReadsBack() {
        store.setSyncEnabled(false)
        XCTAssertFalse(store.getSyncEnabled())

        store.setSyncEnabled(true)
        XCTAssertTrue(store.getSyncEnabled())
    }

    // MARK: - getLastSyncDate

    func testGetLastSyncDateReturnsNilWhenNoSync() {
        XCTAssertNil(store.getLastSyncDate())
    }

    func testGetLastSyncDateReturnsNilWhenRowExistsButNoDate() {
        // setSyncEnabled creates a row without a last_sync_date
        store.setSyncEnabled(true)
        XCTAssertNil(store.getLastSyncDate())
    }

    func testUpdateSyncMetadataSetsDate() {
        store.updateSyncMetadata()
        let date = store.getLastSyncDate()
        XCTAssertNotNil(date)

        // Date should be recent (within the last 5 seconds)
        if let date {
            let elapsed = Date().timeIntervalSince(date)
            XCTAssertLessThan(elapsed, 5.0, "Last sync date should be recent")
        }
    }

    // MARK: - getLastSyncStats

    func testGetLastSyncStatsReturnsNilWhenNoRow() {
        XCTAssertNil(store.getLastSyncStats())
    }

    func testGetLastSyncStatsReturnsNilWhenNoSyncDate() {
        // Row exists (from setSyncEnabled) but last_sync_date is nil
        store.setSyncEnabled(true)
        XCTAssertNil(store.getLastSyncStats())
    }

    func testGetLastSyncStatsReturnsStatsAfterUpdate() {
        store.updateSyncMetadata()
        let stats = store.getLastSyncStats()
        XCTAssertNotNil(stats)
        // updateSyncMetadata doesn't set stats columns, so they default to 0
        XCTAssertEqual(stats?.uploaded, 0)
        XCTAssertEqual(stats?.downloaded, 0)
        XCTAssertEqual(stats?.conflicts, 0)
    }

    // MARK: - Row deduplication

    func testMultipleUpdateSyncMetadataDoesNotDuplicateRow() throws {
        store.updateSyncMetadata()
        XCTAssertEqual(try rowCount(), 1)

        store.updateSyncMetadata()
        XCTAssertEqual(try rowCount(), 1)

        store.updateSyncMetadata()
        XCTAssertEqual(try rowCount(), 1)
    }

    func testSetSyncEnabledThenUpdateDoesNotDuplicateRow() throws {
        store.setSyncEnabled(false)
        XCTAssertEqual(try rowCount(), 1)

        store.updateSyncMetadata()
        XCTAssertEqual(try rowCount(), 1)

        store.setSyncEnabled(true)
        XCTAssertEqual(try rowCount(), 1)
    }

    func testUpdateThenSetSyncEnabledPreservesDate() {
        store.updateSyncMetadata()
        let dateBeforeToggle = store.getLastSyncDate()
        XCTAssertNotNil(dateBeforeToggle)

        store.setSyncEnabled(false)
        // setSyncEnabled should not clear last_sync_date
        let dateAfterToggle = store.getLastSyncDate()
        XCTAssertNotNil(dateAfterToggle)
    }
}
