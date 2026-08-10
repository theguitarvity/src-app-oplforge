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
    val boxArtUrl: String? = null
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
}
