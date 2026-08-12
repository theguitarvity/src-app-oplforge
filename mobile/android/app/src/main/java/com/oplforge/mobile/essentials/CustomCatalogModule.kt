package com.oplforge.mobile.essentials

import com.oplforge.mobile.specs.NativeCustomCatalogModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.ErrorMapping
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

private val MEDIA_TYPES = setOf("ps2-dvd", "ps2-cd", "ps1")

/**
 * TurboModule for the user-supplied Essentials catalog (CSV import or manual
 * entry) — a persisted list distinct from EssentialsModule's cached remote
 * catalog. Entries are shaped exactly like CatalogListing so they feed
 * straight into EssentialsModule.confirmAndEnqueue() with no other change
 * needed to the download pipeline. Mirrors desktop's custom-catalog.service.ts.
 */
class CustomCatalogModule(reactContext: ReactApplicationContext) :
    NativeCustomCatalogModuleSpec(reactContext) {

    private val db = AppDatabase.getInstance(reactContext)
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun listCustomCatalog(query: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val all = db.customCatalogEntryDao().getAll()
                val search = query.getString("search")?.lowercase()
                val mediaType = query.getString("mediaType")
                val filtered = all.filter { entry ->
                    (search.isNullOrBlank() || entry.title.lowercase().contains(search) || entry.fileName.lowercase().contains(search)) &&
                        (mediaType.isNullOrBlank() || mediaType == "all" || entry.mediaType == mediaType)
                }
                val array = Arguments.createArray()
                filtered.forEach { array.pushMap(entryToMap(it)) }
                promise.resolve(array)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    override fun addCustomCatalogEntry(input: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val entry = toEntity(input)
                db.customCatalogEntryDao().insert(entry)
                promise.resolve(entryToMap(entry))
            } catch (e: IllegalArgumentException) {
                ErrorMapping.reject(promise, AppError("INVALID_INPUT", e.message ?: "Entrada inválida."))
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    override fun removeCustomCatalogEntry(id: String, promise: Promise) {
        scope.launch {
            try {
                db.customCatalogEntryDao().deleteById(id)
                promise.resolve(null)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    /**
     * [uri] is the content:// URI from expo-document-picker's result, passed
     * straight through from JS (same pattern as ImportGameButton's transfer
     * enqueue) — read here via ContentResolver rather than round-tripping the
     * decoded text through the bridge, since expo-file-system isn't a
     * dependency of this app.
     */
    override fun importCustomCatalogCsv(uri: String, promise: Promise) {
        scope.launch {
            try {
                val csvContent = reactApplicationContext.contentResolver.openInputStream(android.net.Uri.parse(uri))
                    ?.use { it.readBytes().toString(Charsets.UTF_8) }
                    ?: throw java.io.IOException("Não foi possível ler o arquivo selecionado.")
                val result = parseAndImportCsv(csvContent)
                promise.resolve(result)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    private suspend fun parseAndImportCsv(csvContent: String): WritableMap {
        val lines = csvContent.split(Regex("\r?\n")).filter { it.isNotBlank() }
        val added = Arguments.createArray()
        val errors = Arguments.createArray()
        if (lines.isEmpty()) {
            errors.pushString("Arquivo CSV vazio.")
            return Arguments.createMap().apply { putArray("added", added); putArray("errors", errors) }
        }

        val header = parseCsvLine(lines[0]).map { it.lowercase() }
        val titleIdx = header.indexOf("title")
        val fileNameIdx = header.indexOf("filename")
        val urlIdx = header.indexOf("url")
        val sizeIdx = header.indexOf("sizebytes")
        val mediaTypeIdx = header.indexOf("mediatype")
        if (titleIdx == -1 || fileNameIdx == -1 || urlIdx == -1) {
            errors.pushString("Cabeçalho inválido — esperado: title,fileName,url,sizeBytes,mediaType")
            return Arguments.createMap().apply { putArray("added", added); putArray("errors", errors) }
        }

        val entries = mutableListOf<CustomCatalogEntryEntity>()
        for (i in 1 until lines.size) {
            val row = parseCsvLine(lines[i])
            try {
                val sizeBytes = if (sizeIdx >= 0) row.getOrNull(sizeIdx)?.toLongOrNull() else null
                val mediaTypeRaw = if (mediaTypeIdx >= 0) row.getOrNull(mediaTypeIdx)?.lowercase() else null
                val entry = toEntity(
                    title = row.getOrNull(titleIdx) ?: "",
                    fileName = row.getOrNull(fileNameIdx) ?: "",
                    url = row.getOrNull(urlIdx) ?: "",
                    sizeBytes = sizeBytes,
                    mediaType = mediaTypeRaw?.takeIf { it in MEDIA_TYPES }
                )
                entries.add(entry)
                added.pushMap(entryToMap(entry))
            } catch (e: IllegalArgumentException) {
                errors.pushString("Linha ${i + 1}: ${e.message}")
            }
        }
        if (entries.isNotEmpty()) db.customCatalogEntryDao().insertAll(entries)
        return Arguments.createMap().apply { putArray("added", added); putArray("errors", errors) }
    }

    /** Minimal CSV line parser: comma-separated, double-quote escaping for fields containing commas. */
    private fun parseCsvLine(line: String): List<String> {
        val fields = mutableListOf<String>()
        val current = StringBuilder()
        var inQuotes = false
        var i = 0
        while (i < line.length) {
            val char = line[i]
            if (inQuotes) {
                if (char == '"' && i + 1 < line.length && line[i + 1] == '"') {
                    current.append('"')
                    i++
                } else if (char == '"') {
                    inQuotes = false
                } else {
                    current.append(char)
                }
            } else if (char == '"') {
                inQuotes = true
            } else if (char == ',') {
                fields.add(current.toString().trim())
                current.clear()
            } else {
                current.append(char)
            }
            i++
        }
        fields.add(current.toString().trim())
        return fields
    }

    private fun toEntity(input: ReadableMap): CustomCatalogEntryEntity = toEntity(
        title = input.getString("title") ?: "",
        fileName = input.getString("fileName") ?: "",
        url = input.getString("url") ?: "",
        sizeBytes = if (input.hasKey("sizeBytes")) input.getDouble("sizeBytes").toLong() else null,
        mediaType = input.getString("mediaType")
    )

    private fun toEntity(title: String, fileName: String, url: String, sizeBytes: Long?, mediaType: String?): CustomCatalogEntryEntity {
        val trimmedTitle = title.trim()
        val trimmedFileName = fileName.trim()
        val trimmedUrl = url.trim()
        require(trimmedTitle.isNotEmpty()) { "Título é obrigatório." }
        require(trimmedFileName.isNotEmpty()) { "Nome do arquivo é obrigatório." }
        require(trimmedUrl.isNotEmpty()) { "URL é obrigatória." }
        return CustomCatalogEntryEntity(
            id = "custom:${UUID.randomUUID()}",
            title = trimmedTitle,
            fileName = trimmedFileName,
            url = trimmedUrl,
            sizeBytes = sizeBytes,
            mediaType = mediaType?.takeIf { it in MEDIA_TYPES } ?: "ps2-dvd",
            addedAt = Instant.now().toString()
        )
    }

    private fun entryToMap(entry: CustomCatalogEntryEntity): WritableMap = Arguments.createMap().apply {
        putString("id", entry.id)
        putString("title", entry.title)
        putString("fileName", entry.fileName)
        putString("url", entry.url)
        entry.sizeBytes?.let { putDouble("sizeBytes", it.toDouble()) }
        putString("mediaType", entry.mediaType)
        putString("scoreTier", "Unrated")
        putBoolean("accessible", true)
        putString("checkedAt", entry.addedAt)
    }

    companion object {
        const val NAME = "CustomCatalogModule"
    }
}
