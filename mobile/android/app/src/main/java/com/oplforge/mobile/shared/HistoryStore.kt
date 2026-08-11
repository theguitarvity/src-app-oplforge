package com.oplforge.mobile.shared

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import java.time.Instant
import java.util.UUID

/** Room row for one local history entry (data-model.md LocalHistoryEntry, FR-027). */
@Entity(tableName = "local_history")
data class LocalHistoryEntity(
    @PrimaryKey val id: String,
    val operation: String,
    val result: String,
    val message: String,
    val timestamp: String
)

@Dao
interface LocalHistoryDao {
    @Insert
    suspend fun insert(entry: LocalHistoryEntity)

    @Query("SELECT * FROM local_history ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecent(limit: Int): List<LocalHistoryEntity>
}

/**
 * Minimal local operation history (FR-027). [message] MUST NEVER include a
 * credential — every call site here passes a pre-sanitized, plain-language
 * string (contracts/native-modules.md "Shared constraints").
 */
class HistoryStore(private val db: AppDatabase) {

    suspend fun record(operation: String, result: String, message: String) {
        db.localHistoryDao().insert(
            LocalHistoryEntity(
                id = UUID.randomUUID().toString(),
                operation = operation,
                result = result,
                message = message,
                timestamp = Instant.now().toString()
            )
        )
    }

    companion object {
        const val OP_LIBRARY_SELECTED = "library-selected"
        const val OP_CATALOG_SCAN_COMPLETED = "catalog-scan-completed"
        const val OP_SHARING_STARTED = "sharing-started"
        const val OP_SHARING_STOPPED = "sharing-stopped"
        const val OP_WRITE_ACCESS_ACKNOWLEDGED = "write-access-acknowledged"
        const val OP_GAME_DELETED = "game-deleted"

        const val RESULT_SUCCESS = "success"
        const val RESULT_FAILURE = "failure"
    }
}
