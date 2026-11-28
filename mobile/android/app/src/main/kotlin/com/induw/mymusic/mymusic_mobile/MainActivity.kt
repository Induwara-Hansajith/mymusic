package com.induw.mymusic.mymusic_mobile

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import com.ryanheise.audioservice.AudioServiceActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : AudioServiceActivity() {
    companion object {
        private const val CHANNEL = "com.induw.mymusic/native"
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "getAppVersion" -> {
                        try {
                            val pkgInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                packageManager.getPackageInfo(
                                    packageName,
                                    android.content.pm.PackageManager.PackageInfoFlags.of(0)
                                )
                            } else {
                                @Suppress("DEPRECATION")
                                packageManager.getPackageInfo(packageName, 0)
                            }
                            val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                pkgInfo.longVersionCode
                            } else {
                                @Suppress("DEPRECATION")
                                pkgInfo.versionCode.toLong()
                            }
                            result.success(
                                mapOf(
                                    "versionName" to (pkgInfo.versionName ?: "1.1.9"),
                                    "versionCode" to code
                                )
                            )
                        } catch (e: Exception) {
                            result.error("VERSION_ERR", e.message, null)
                        }
                    }

                    "enqueueDownload" -> {
                        try {
                            val url = call.argument<String>("url")
                                ?: return@setMethodCallHandler result.error("ARG_ERR", "Missing url", null)
                            val fileName = call.argument<String>("fileName")
                                ?: return@setMethodCallHandler result.error("ARG_ERR", "Missing fileName", null)
                            val title = call.argument<String>("title") ?: fileName
                            val description = call.argument<String>("description") ?: ""
                            val mimeType = call.argument<String>("mimeType")
                            val notifyCompleted = call.argument<Boolean>("notifyCompleted") ?: true
                            val headers = call.argument<Map<String, String>>("headers")

                            val downloadDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                            if (downloadDir != null && !downloadDir.exists()) {
                                downloadDir.mkdirs()
                            }
                            val destFile = File(downloadDir, fileName)
                            if (destFile.exists()) {
                                destFile.delete()
                            }

                            val request = DownloadManager.Request(Uri.parse(url)).apply {
                                setTitle(title)
                                if (description.isNotEmpty()) setDescription(description)
                                if (!mimeType.isNullOrEmpty()) setMimeType(mimeType)
                                setAllowedOverMetered(true)
                                setAllowedOverRoaming(true)
                                setNotificationVisibility(
                                    if (notifyCompleted)
                                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                                    else
                                        DownloadManager.Request.VISIBILITY_VISIBLE
                                )
                                setDestinationInExternalFilesDir(
                                    this@MainActivity,
                                    Environment.DIRECTORY_DOWNLOADS,
                                    fileName
                                )
                                headers?.forEach { (k, v) -> addRequestHeader(k, v) }
                            }

                            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                            val downloadId = dm.enqueue(request)
                            result.success(
                                mapOf(
                                    "downloadId" to downloadId,
                                    "destPath" to destFile.absolutePath
                                )
                            )
                        } catch (e: Exception) {
                            result.error("ENQUEUE_ERR", e.message, null)
                        }
                    }

                    "queryDownload" -> {
                        try {
                            val rawId = call.argument<Number>("downloadId")
                                ?: return@setMethodCallHandler result.error("ARG_ERR", "Missing downloadId", null)
                            val downloadId = rawId.toLong()
                            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                            val cursor: Cursor? = dm.query(DownloadManager.Query().setFilterById(downloadId))
                            if (cursor == null || !cursor.moveToFirst()) {
                                cursor?.close()
                                result.success(mapOf("status" to "unknown", "bytesDownloaded" to 0L, "bytesTotal" to -1L, "reason" to 0))
                                return@setMethodCallHandler
                            }
                            cursor.use { c ->
                                val statusInt = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                                val downloaded = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                                val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                                val reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                                val localUriIdx = c.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)
                                val localUri = if (localUriIdx >= 0) c.getString(localUriIdx) else null
                                val statusStr = when (statusInt) {
                                    DownloadManager.STATUS_PENDING -> "pending"
                                    DownloadManager.STATUS_RUNNING -> "running"
                                    DownloadManager.STATUS_PAUSED -> "paused"
                                    DownloadManager.STATUS_SUCCESSFUL -> "successful"
                                    DownloadManager.STATUS_FAILED -> "failed"
                                    else -> "unknown"
                                }
                                result.success(
                                    mapOf(
                                        "status" to statusStr,
                                        "bytesDownloaded" to downloaded,
                                        "bytesTotal" to total,
                                        "reason" to reason,
                                        "localUri" to localUri
                                    )
                                )
                            }
                        } catch (e: Exception) {
                            result.error("QUERY_ERR", e.message, null)
                        }
                    }

                    "cancelDownload" -> {
                        try {
                            val rawId = call.argument<Number>("downloadId")
                            if (rawId != null) {
                                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                                dm.remove(rawId.toLong())
                            }
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("CANCEL_ERR", e.message, null)
                        }
                    }

                    "canRequestPackageInstalls" -> {
                        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            packageManager.canRequestPackageInstalls()
                        } else {
                            true
                        }
                        result.success(granted)
                    }

                    "openUnknownSourcesSettings" -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            val intent = Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:$packageName")
                            ).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(intent)
                        }
                        result.success(true)
                    }

                    "installApk" -> {
                        try {
                            val filePath = call.argument<String>("filePath")
                                ?: return@setMethodCallHandler result.error("ARG_ERR", "Missing filePath", null)
                            val file = File(filePath)
                            if (!file.exists() || file.length() == 0L) {
                                return@setMethodCallHandler result.error("FILE_ERR", "APK file missing or empty", null)
                            }
                            val apkUri = FileProvider.getUriForFile(
                                this,
                                "$packageName.fileprovider",
                                file
                            )
                            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(apkUri, "application/vnd.android.package-archive")
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            startActivity(installIntent)
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("INSTALL_ERR", e.message, null)
                        }
                    }

                    else -> result.notImplemented()
                }
            }
    }
}
