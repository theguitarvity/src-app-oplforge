package com.oplforge.mobile.essentials

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query

/**
 * User-supplied Essentials entries (CSV import or manual form), stored
 * separately from the cached remote catalog (CatalogListingCacheEntity).
 * Shaped so it can be handed straight into EssentialsModule.confirmAndEnqueue
 * — the download pipeline doesn't care where a listing came from, only that
 * it has these fields. Mirrors desktop's custom-catalog.service.ts.
 */
@Entity(tableName = "custom_catalog_entry")
data class CustomCatalogEntryEntity(
    @PrimaryKey val id: String,
    val title: String,
    val fileName: String,
    val url: String,
    val sizeBytes: Long?,
    val mediaType: String, // "ps2-dvd" | "ps2-cd" | "ps1"
    val addedAt: String
)

@Dao
interface CustomCatalogEntryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: CustomCatalogEntryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<CustomCatalogEntryEntity>)

    @Query("SELECT * FROM custom_catalog_entry ORDER BY addedAt DESC")
    suspend fun getAll(): List<CustomCatalogEntryEntity>

    @Query("DELETE FROM custom_catalog_entry WHERE id = :id")
    suspend fun deleteById(id: String)
}
