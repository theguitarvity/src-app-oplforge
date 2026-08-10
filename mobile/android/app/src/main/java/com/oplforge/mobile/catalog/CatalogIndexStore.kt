package com.oplforge.mobile.catalog

import com.oplforge.mobile.shared.AppDatabase
import java.time.Instant
import java.util.UUID

/**
 * Room-backed persistence for catalog scans (data-model.md CatalogSnapshot/CatalogEntry).
 * A new scan always creates a new snapshot rather than mutating a prior one in
 * place, so a cancelled/failed scan never corrupts the last-known-good state
 * (spec FR-010).
 */
class CatalogIndexStore(private val db: AppDatabase) {

    suspend fun startSnapshot(): CatalogSnapshotEntity {
        val snapshot = CatalogSnapshotEntity(
            id = UUID.randomUUID().toString(),
            state = "running",
            startedAt = Instant.now().toString(),
            completedAt = null,
            dvdCount = 0,
            cdCount = 0,
            ps1Count = 0,
            appCount = 0,
            issueCount = 0,
            errorCode = null,
            errorMessage = null
        )
        db.catalogSnapshotDao().insert(snapshot)
        return snapshot
    }

    suspend fun appendEntries(entries: List<CatalogEntryEntity>) {
        if (entries.isNotEmpty()) db.catalogEntryDao().insertAll(entries)
    }

    suspend fun completeSnapshot(snapshot: CatalogSnapshotEntity, countsByType: Map<String, Int>, issueCount: Int) {
        db.catalogSnapshotDao().update(
            snapshot.copy(
                state = "completed",
                completedAt = Instant.now().toString(),
                dvdCount = countsByType["dvd"] ?: 0,
                cdCount = countsByType["cd"] ?: 0,
                ps1Count = countsByType["ps1"] ?: 0,
                appCount = countsByType["app"] ?: 0,
                issueCount = issueCount
            )
        )
    }

    suspend fun cancelSnapshot(snapshot: CatalogSnapshotEntity) {
        db.catalogSnapshotDao().update(snapshot.copy(state = "cancelled", completedAt = Instant.now().toString()))
    }

    suspend fun failSnapshot(snapshot: CatalogSnapshotEntity, errorCode: String, errorMessage: String) {
        db.catalogSnapshotDao().update(
            snapshot.copy(
                state = "error",
                completedAt = Instant.now().toString(),
                errorCode = errorCode,
                errorMessage = errorMessage
            )
        )
    }

    suspend fun getLatest(): CatalogSnapshotEntity? = db.catalogSnapshotDao().getLatest()

    suspend fun getLatestCompleted(): CatalogSnapshotEntity? = db.catalogSnapshotDao().getLatestCompleted()

    /** Windowed read for library browsing (US6, contracts/native-modules.md Performance note). */
    suspend fun getEntriesPage(snapshotId: String, typeFilter: String, page: Int, pageSize: Int): List<CatalogEntryEntity> =
        db.catalogEntryDao().getPage(snapshotId, typeFilter, pageSize, page * pageSize)
}
