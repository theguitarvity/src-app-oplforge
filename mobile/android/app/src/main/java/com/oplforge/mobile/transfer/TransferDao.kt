package com.oplforge.mobile.transfer

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update

@Dao
interface TransferDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: TransferItemEntity)

    @Update
    suspend fun update(item: TransferItemEntity)

    @Query("SELECT * FROM transfer_item WHERE id = :id")
    suspend fun getById(id: String): TransferItemEntity?

    @Query("SELECT * FROM transfer_item ORDER BY createdAt DESC")
    suspend fun getAll(): List<TransferItemEntity>

    @Query("SELECT * FROM transfer_item WHERE state = 'running'")
    suspend fun getRunning(): List<TransferItemEntity>

    @Query("UPDATE transfer_item SET state = :toState WHERE state = :fromState")
    suspend fun reassignState(fromState: String, toState: String)

    @Query("SELECT * FROM transfer_item WHERE destinationLogicalPath = :path AND state IN ('queued','running') LIMIT 1")
    suspend fun getActiveForPath(path: String): TransferItemEntity?
}
