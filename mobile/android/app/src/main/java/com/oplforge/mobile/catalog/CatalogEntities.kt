package com.oplforge.mobile.catalog

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter

/** Room row for one scan run (data-model.md CatalogSnapshot). */
@Entity(tableName = "catalog_snapshot")
data class CatalogSnapshotEntity(
    @PrimaryKey val id: String,
    val state: String,
    val startedAt: String,
    val completedAt: String?,
    val dvdCount: Int,
    val cdCount: Int,
    val ps1Count: Int,
    val appCount: Int,
    val issueCount: Int,
    val errorCode: String?,
    val errorMessage: String?
)

/** Room row for one recognized library item (data-model.md CatalogEntry). */
@Entity(tableName = "catalog_entry")
data class CatalogEntryEntity(
    @PrimaryKey val id: String,
    val snapshotId: String,
    val contentType: String,
    val gameId: String?,
    val title: String,
    val extension: String,
    val sizeBytes: Long,
    val logicalPath: String,
    val hasArt: Boolean,
    val namingConformance: String,
    val structuralIssues: List<String>
)

/** `structuralIssues` is stored as a delimited string — never contains the delimiter itself (it's app-generated). */
class StructuralIssuesConverter {
    @TypeConverter
    fun fromList(value: List<String>): String = value.joinToString("|||")

    @TypeConverter
    fun toList(value: String): List<String> = if (value.isEmpty()) emptyList() else value.split("|||")
}
