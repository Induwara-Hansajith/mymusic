package com.induw.mymusic.youtube

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import java.util.concurrent.TimeUnit

class NewPipeDownloaderImpl(
    private val http: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
) : Downloader() {
    override fun execute(request: Request): Response {
        val builder = okhttp3.Request.Builder()
            .url(request.url())
            .method(
                request.httpMethod(),
                request.dataToSend()?.toRequestBody(null)
            )
        request.headers().forEach { (key, values) ->
            values.forEach { value -> builder.addHeader(key, value) }
        }
        if (request.headers()["User-Agent"].isNullOrEmpty()) {
            builder.header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }
        http.newCall(builder.build()).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            val headers = LinkedHashMap<String, List<String>>()
            resp.headers.names().forEach { name ->
                headers[name] = resp.headers.values(name)
            }
            if (resp.code == 429) {
                throw ReCaptchaException("reCAPTCHA challenge", request.url())
            }
            return Response(resp.code, resp.message, headers, body, request.url())
        }
    }
}
