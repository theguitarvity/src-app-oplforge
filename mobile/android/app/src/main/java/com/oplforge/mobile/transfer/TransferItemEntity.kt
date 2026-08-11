package com.oplforge.mobile.transfer

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Room row for one queued/active/completed transfer (data-model.md TransferItem). */
@Entity(tableName = "transfer_item")
data class TransferItemEntity(
    @PrimaryKey val id: String,
    val kind: String, // "download" | "import"
    val sourceUrl: String?, // set for kind = download
    val sourceTreeUri: String?, // set for kind = import
    val destinationLogicalPath: String,
    val title: String,
    val expectedBytes: Long?,
    val transferredBytes: Long,
    val state: String, // "queued" | "running" | "paused" | "failed" | "completed"
    val legalReceiptId: String?,
    val partFiles: List<String>,
    val errorMessage: String?,
    val createdAt: String,
    val updatedAt: String,
    // User confirmed replacing an existing same-name file at enqueue time —
    // persisted (not just an in-memory flag) so WorkManager retries after
    // process death still know to overwrite rather than re-reject as a
    // duplicate. Defaults false so existing/older rows behave unchanged.
    val overwrite: Boolean = false
)

object TransferState {
    const val QUEUED = "queued"
    const val RUNNING = "running"
    const val PAUSED = "paused"
    const val FAILED = "failed"
    const val COMPLETED = "completed"
}

object TransferKind {
    const val DOWNLOAD = "download"
    const val IMPORT = "import"
}
