package com.oplforge.mobile.diagnostics

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query

/** Room row for one Diagnostics run (data-model.md DiagnosticsReport). */
@Entity(tableName = "diagnostics_report")
data class DiagnosticsReportEntity(
    @PrimaryKey val id: String,
    val missingFolders: List<String>,
    val freeBytes: Long?,
    val catalogSnapshotId: String,
    val readiness: String, // "ready" | "ready-with-warnings" | "requires-reorganization" | "incompatible"
    val checkedAt: String
)

@Dao
interface DiagnosticsReportDao {
    @Insert
    suspend fun insert(report: DiagnosticsReportEntity)

    @Query("SELECT * FROM diagnostics_report ORDER BY checkedAt DESC LIMIT 1")
    suspend fun getLatest(): DiagnosticsReportEntity?
}
