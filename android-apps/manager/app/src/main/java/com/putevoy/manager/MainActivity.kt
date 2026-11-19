package com.putevoy.manager

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import com.putevoy.manager.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private val prefs by lazy { getSharedPreferences("putevoy", Context.MODE_PRIVATE) }
    private val pagePath: String by lazy { getString(R.string.page_path) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupWebView()
        binding.openButton.setOnClickListener { saveAndOpen() }

        val saved = prefs.getString("server", "")?.trim().orEmpty()
        if (saved.isNotEmpty()) {
            binding.serverInput.setText(saved)
            openServer(saved)
        } else {
            showSetup()
        }
    }

    private fun setupWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(binding.webView, true)
        binding.webView.setBackgroundColor(Color.parseColor("#1E1A17"))
        binding.webView.webChromeClient = WebChromeClient()
        binding.webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return false
            }
        }
        val settings = binding.webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.mediaPlaybackRequiresUserGesture = false
    }

    private fun saveAndOpen() {
        val raw = binding.serverInput.text?.toString()?.trim().orEmpty()
        val server = normalizeServer(raw)
        if (server == null) {
            Toast.makeText(this, "Укажите адрес вида http://192.168.0.10:5173", Toast.LENGTH_LONG).show()
            return
        }
        prefs.edit().putString("server", server).apply()
        openServer(server)
    }

    private fun openServer(server: String) {
        binding.setupPanel.visibility = View.GONE
        binding.webView.visibility = View.VISIBLE
        val url = server.trimEnd('/') + pagePath
        binding.webView.loadUrl(url)
    }

    private fun showSetup() {
        binding.webView.visibility = View.GONE
        binding.setupPanel.visibility = View.VISIBLE
    }

    private fun normalizeServer(raw: String): String? {
        if (raw.isBlank()) return null
        var value = raw.trim()
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            value = "http://$value"
        }
        return try {
            val uri = android.net.Uri.parse(value)
            if (uri.host.isNullOrBlank()) null else value.trimEnd('/')
        } catch (_: Exception) {
            null
        }
    }

    override fun onBackPressed() {
        if (binding.webView.visibility == View.VISIBLE && binding.webView.canGoBack()) {
            binding.webView.goBack()
        } else if (binding.webView.visibility == View.VISIBLE) {
            showSetup()
        } else {
            super.onBackPressed()
        }
    }
}
