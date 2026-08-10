package com.oplforge.mobile.transfer

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.oplforge.mobile.shared.AppDatabase
import java.time.Instant

/**
 * Shared WorkManager enqueue/observe surface — used by both
 * `TransferQueueModule` (imports, retries, cancellation) and
 * `EssentialsModule` (downloads), so there's exactly one place that turns a
 * `TransferItemEntity` into scheduled work (spec 008 plan.md Structure
 * Decision: an import is a same-device "download" with a different source).
 */
class TransferScheduler(private val context: Context) {
    private val workManager = WorkManager.getInstance(context)
    private val db = AppDatabase.getInstance(context)

    suspend fun enqueueDownload(
        destinationLogicalPath: String,
        title: String,
        sourceUrl: String,
        expectedBytes: Long?,
        legalReceiptId: String
    ): TransferItemEntity {
        val item = newItem(
            kind = TransferKind.DOWNLOAD,
            destinationLogicalPath = destinationLogicalPath,
            title = title,
            sourceUrl = sourceUrl,
            sourceTreeUri = null,
            expectedBytes = expectedBytes,
            legalReceiptId = legalReceiptId
        )
        db.transferDao().insert(item)
        schedule(item.id)
        return item
    }

    suspend fun enqueueImport(destinationLogicalPath: String, title: String, sourceTreeUri: String, expectedBytes: Long?): TransferItemEntity {
        val item = newItem(
            kind = TransferKind.IMPORT,
            destinationLogicalPath = destinationLogicalPath,
            title = title,
            sourceUrl = null,
            sourceTreeUri = sourceTreeUri,
            expectedBytes = expectedBytes,
            legalReceiptId = null
        )
        db.transferDao().insert(item)
        schedule(item.id)
        return item
    }

    fun retry(transferId: String) {
        schedule(transferId)
    }

    fun cancel(transferId: String) {
        workManager.cancelUniqueWork(workName(transferId))
    }

    fun observeQueue() = workManager.getWorkInfosByTagLiveData(TAG)

    private fun schedule(transferId: String) {
        val request = OneTimeWorkRequestBuilder<TransferWorker>()
            .setInputData(workDataOf(TransferWorker.KEY_TRANSFER_ID to transferId))
            .setConstraints(Constraints.Builder().setRequiresStorageNotLow(true).build())
            .addTag(TAG)
            .addTag(transferId)
            .build()
        workManager.enqueueUniqueWork(workName(transferId), ExistingWorkPolicy.REPLACE, request)
    }

    private fun workName(transferId: String) = "transfer:$transferId"

    private fun newItem(
        kind: String,
        destinationLogicalPath: String,
        title: String,
        sourceUrl: String?,
        sourceTreeUri: String?,
        expectedBytes: Long?,
        legalReceiptId: String?
    ): TransferItemEntity {
        val now = Instant.now().toString()
        return TransferItemEntity(
            id = java.util.UUID.randomUUID().toString(),
            kind = kind,
            sourceUrl = sourceUrl,
            sourceTreeUri = sourceTreeUri,
            destinationLogicalPath = destinationLogicalPath,
            title = title,
            expectedBytes = expectedBytes,
            transferredBytes = 0,
            state = TransferState.QUEUED,
            legalReceiptId = legalReceiptId,
            partFiles = emptyList(),
            errorMessage = null,
            createdAt = now,
            updatedAt = now
        )
    }

    companion object {
        const val TAG = "oplforge-transfer"
    }
}
