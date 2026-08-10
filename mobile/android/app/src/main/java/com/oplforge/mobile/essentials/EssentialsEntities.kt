package com.oplforge.mobile.essentials

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query

/** Room row for one cached Essentials catalog item (data-model.md CatalogListing, research.md R1/R2). */
@Entity(tableName = "catalog_listing_cache")
data class CatalogListingCacheEntity(
    @PrimaryKey val id: String,
    val title: String,
    val fileName: String,
    val url: String,
    val sizeBytes: Long?,
    val mediaType: String, // "ps2-dvd" | "ps2-cd" | "ps1"
    val scoreTier: String,
    val accessible: Boolean,
    val checkedAt: String,
    /** Best-match box art URL from libretro-thumbnails (research.md), resolved once per refresh cycle. */
    val boxArtUrl: String? = null,
    /**
     * False for the fast, metadata-only rows written immediately by
     * getListings() (accessible defaults to true, boxArtUrl is null) — true
     * once the background accessibility/box-art pass has actually run for
     * this row. Without this flag, the quick write's own checkedAt satisfies
     * the 24h freshness check, so a later getListings() call takes the
     * cache-hit path and never kicks off real enrichment at all.
     */
    val enriched: Boolean = false
)

@Dao
interface CatalogListingCacheDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<CatalogListingCacheEntity>)

    @Query("DELETE FROM catalog_listing_cache")
    suspend fun clear()

    @Query("SELECT * FROM catalog_listing_cache ORDER BY scoreTier ASC, title ASC")
    suspend fun getAll(): List<CatalogListingCacheEntity>

    @Query("SELECT MIN(checkedAt) FROM catalog_listing_cache")
    suspend fun oldestCheckedAt(): String?

    @Query("SELECT * FROM catalog_listing_cache WHERE enriched = 0")
    suspend fun getUnenriched(): List<CatalogListingCacheEntity>
}
