package com.oplforge.mobile.catalog

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update

@Dao
interface CatalogSnapshotDao {
    @Insert
    suspend fun insert(snapshot: CatalogSnapshotEntity)

    @Update
    suspend fun update(snapshot: CatalogSnapshotEntity)

    @Query("SELECT * FROM catalog_snapshot ORDER BY startedAt DESC LIMIT 1")
    suspend fun getLatest(): CatalogSnapshotEntity?

    @Query("SELECT * FROM catalog_snapshot WHERE state = 'completed' ORDER BY startedAt DESC LIMIT 1")
    suspend fun getLatestCompleted(): CatalogSnapshotEntity?

    @Query("SELECT * FROM catalog_snapshot WHERE id = :id")
    suspend fun getById(id: String): CatalogSnapshotEntity?
}

@Dao
interface CatalogEntryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<CatalogEntryEntity>)

    @Query(
        """
        SELECT * FROM catalog_entry
        WHERE snapshotId = :snapshotId
        AND (:typeFilter = '' OR contentType = :typeFilter)
        ORDER BY title ASC
        LIMIT :pageSize OFFSET :offset
        """
    )
    suspend fun getPage(snapshotId: String, typeFilter: String, pageSize: Int, offset: Int): List<CatalogEntryEntity>

    @Query("DELETE FROM catalog_entry WHERE snapshotId = :snapshotId")
    suspend fun deleteForSnapshot(snapshotId: String)

    @Query("SELECT * FROM catalog_entry WHERE id = :id")
    suspend fun getById(id: String): CatalogEntryEntity?

    /** Single-row delete, used after a user-initiated title deletion — keeps the cached catalog in sync without a full rescan. */
    @Query("DELETE FROM catalog_entry WHERE id = :id")
    suspend fun deleteById(id: String)

    /** Case-insensitive filename match within one snapshot, for import duplicate detection (spec 008 FR-009). */
    @Query(
        """
        SELECT * FROM catalog_entry
        WHERE snapshotId = :snapshotId
        AND logicalPath LIKE '%' || :fileName
        COLLATE NOCASE
        LIMIT 1
        """
    )
    suspend fun findByFileName(snapshotId: String, fileName: String): CatalogEntryEntity?

    /** Every cataloged game missing box art (Art Sync candidates) — bounded like desktop's own plan (art-sync-plan.service.ts caps at 500). */
    @Query(
        """
        SELECT * FROM catalog_entry
        WHERE snapshotId = :snapshotId
        AND hasArt = 0
        AND gameId IS NOT NULL
        ORDER BY title ASC
        LIMIT 500
        """
    )
    suspend fun getMissingArt(snapshotId: String): List<CatalogEntryEntity>
}
