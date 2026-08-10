package com.oplforge.mobile.catalog

import com.oplforge.mobile.library.SafDocumentTree
import java.util.UUID

data class CatalogScanResult(
    val entries: List<CatalogEntryEntity>,
    val countsByType: Map<String, Int>,
    val issueCount: Int
)

/**
 * Normalizes a raw file/game-id base name to the `<GAMEID>_COV[2]` matching
 * form (mirrors CatalogScanModule.getArtUri's normalization exactly, so
 * scan-time `hasArt` and on-demand art lookup never disagree).
 */
internal fun normalizeArtBaseName(raw: String): String =
    raw.replace('-', '_').replace('.', '_').uppercase()

/**
 * True when [artBaseNames] (normalized art-folder file base names) contains
 * the `_COV`/`_COV2` cover file for [gameId] — OPL's convention is
 * `<GAMEID>_COV[2].png`, never the bare game ID or ISO file name.
 */
internal fun hasMatchingArt(gameId: String?, artBaseNames: Set<String>): Boolean {
    if (gameId == null) return false
    val normalized = normalizeArtBaseName(gameId)
    return artBaseNames.contains("${normalized}_COV") || artBaseNames.contains("${normalized}_COV2")
}

/**
 * Read-only scan of an OPL library folder (spec FR-006–FR-010). Never writes
 * to the tree — every result is a derived, in-memory record (data-model.md
 * CatalogEntry validation rules).
 */
class CatalogScanner(private val tree: SafDocumentTree) {

    private val folderToType = mapOf(
        "DVD" to "dvd",
        "CD" to "cd",
        "PS1" to "ps1",
        "APPS" to "app"
    )

    /** OPL naming convention: `<GAMEID>.<Title>.<ext>`, e.g. `SLUS_212.59.Shadow.of.the.Colossus.iso`. */
    private val gameIdPattern = Regex("^([A-Z]{4}_\\d{3}\\.\\d{2})\\.(.+)$")

    suspend fun scan(
        snapshotId: String,
        onProgress: (Int) -> Unit,
        isCancelled: () -> Boolean
    ): CatalogScanResult {
        val entries = mutableListOf<CatalogEntryEntity>()
        val counts = mutableMapOf("dvd" to 0, "cd" to 0, "ps1" to 0, "app" to 0)
        var issueCount = 0
        var scanned = 0

        val artFolder = tree.findFolder("ART")
        val artBaseNames = tree.filesIn(artFolder)
            .mapNotNull { file -> file.name?.substringBeforeLast('.') }
            .map(::normalizeArtBaseName)
            .toSet()

        for ((folderName, contentType) in folderToType) {
            if (isCancelled()) break
            val folder = tree.findFolder(folderName) ?: continue

            for (file in tree.filesIn(folder)) {
                if (isCancelled()) break
                val fileName = file.name ?: continue
                val extension = fileName.substringAfterLast('.', "")
                val baseName = fileName.substringBeforeLast('.')
                val match = gameIdPattern.find(fileName)

                val gameId = match?.groupValues?.get(1)
                val rawTitle = match?.groupValues?.get(2)?.substringBeforeLast(".$extension") ?: baseName
                val title = rawTitle.replace('.', ' ').trim()
                val namingConformance = if (match != null) "conforms" else "needs-attention"
                val structuralIssues = mutableListOf<String>()
                if (match == null) structuralIssues.add("missing-game-id")

                val hasArt = hasMatchingArt(gameId, artBaseNames)

                entries.add(
                    CatalogEntryEntity(
                        id = UUID.randomUUID().toString(),
                        snapshotId = snapshotId,
                        contentType = contentType,
                        gameId = gameId,
                        title = title.ifEmpty { fileName },
                        extension = extension,
                        sizeBytes = file.length(),
                        logicalPath = "$folderName/$fileName",
                        hasArt = hasArt,
                        namingConformance = namingConformance,
                        structuralIssues = structuralIssues
                    )
                )

                counts[contentType] = (counts[contentType] ?: 0) + 1
                if (structuralIssues.isNotEmpty() || namingConformance == "needs-attention") issueCount++
                scanned++
                onProgress(scanned)
            }
        }

        return CatalogScanResult(entries, counts, issueCount)
    }
}
