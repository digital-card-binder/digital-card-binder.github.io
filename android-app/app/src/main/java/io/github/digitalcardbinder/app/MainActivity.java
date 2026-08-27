package io.github.digitalcardbinder.app;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONObject;

import java.util.Collections;
import java.util.List;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://digital-card-binder.github.io/";
    private static final String HOME_HOST = "digital-card-binder.github.io";
    private static final String FIREBASE_AUTH_HOST = "pokemon-dex-40e92.firebaseapp.com";
    private static final String FIREBASE_WEB_HOST = "pokemon-dex-40e92.web.app";
    private static final String FIREBASE_JS_VERSION = "12.16.0";
    private static final String SHEETS_SCOPE =
            "https://www.googleapis.com/auth/spreadsheets";
    private static final int SHEETS_AUTH_REQUEST_CODE = 4108;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private CredentialManager credentialManager;
    private boolean signInInProgress = false;
    private boolean sheetsAuthorizationInProgress = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            createApp(savedInstanceState);
        } catch (Throwable error) {
            showFatalError(error);
        }
    }

    private void createApp(Bundle savedInstanceState) {
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        credentialManager = CredentialManager.create(this);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        applySafeAreaInsets(root);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new NativeAuthBridge(), "DigitalCardBinderApp");

        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgress(0);

        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(progress, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                6));

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                return handleUrl(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();
                if (url != null && url.startsWith(HOME_URL)) {
                    installNativeLoginBridge(view);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(
                            HOME_URL,
                            "<html><body style='font-family:sans-serif;padding:32px'><h2>디지털 카드 바인더</h2><p>사이트를 불러오지 못했습니다.</p><p>인터넷 연결을 확인한 뒤 앱을 다시 열어주세요.</p></body></html>",
                            "text/html",
                            "UTF-8",
                            null);
                }
            }
        });

        setContentView(root);

        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) {
            return;
        }
        webView.loadUrl(HOME_URL);
    }

    private void installNativeLoginBridge(WebView view) {
        String script =
                "(function(){" +
                "window.POKEMON_DEX_ANDROID_APP=true;" +
                "window.DigitalCardBinderNativeSignIn=function(){" +
                "if(typeof DigitalCardBinderApp!=='undefined'&&DigitalCardBinderApp.startGoogleSignIn){DigitalCardBinderApp.startGoogleSignIn();return true;}" +
                "return false;" +
                "};" +
                "window.DigitalCardBinderNativeSheetsAuthorization=function(){" +
                "if(typeof DigitalCardBinderApp!=='undefined'&&DigitalCardBinderApp.startSheetsAuthorization){DigitalCardBinderApp.startSheetsAuthorization();return true;}" +
                "return false;" +
                "};" +
                "if(window.__digitalCardBinderNativeAuthInstalled)return;" +
                "window.__digitalCardBinderNativeAuthInstalled=true;" +
                "document.addEventListener('click',function(event){" +
                "var target=event.target;" +
                "if(!target||!target.closest)return;" +
                "var button=target.closest('#firebase-login,#dashboard-login-cta,[data-google-login],[data-auth-login],button,a');" +
                "if(!button)return;" +
                "var text=(button.textContent||'').replace(/\\s+/g,' ').trim();" +
                "var known=button.matches('#firebase-login,#dashboard-login-cta,[data-google-login],[data-auth-login]')||/Google 로그인|내 도감 로그인/.test(text);" +
                "if(!known)return;" +
                "if(typeof DigitalCardBinderApp==='undefined'||!DigitalCardBinderApp.startGoogleSignIn)return;" +
                "event.preventDefault();" +
                "event.stopPropagation();" +
                "if(event.stopImmediatePropagation)event.stopImmediatePropagation();" +
                "DigitalCardBinderApp.startGoogleSignIn();" +
                "},true);" +
                "})();";
        view.evaluateJavascript(script, null);
    }

    public final class NativeAuthBridge {
        @JavascriptInterface
        public void startGoogleSignIn() {
            runOnUiThread(() -> beginGoogleSignIn(true));
        }

        @JavascriptInterface
        public void startSheetsAuthorization() {
            runOnUiThread(MainActivity.this::beginSheetsAuthorization);
        }
    }

    private void beginGoogleSignIn(boolean authorizedOnly) {
        if (signInInProgress || credentialManager == null) return;
        signInInProgress = true;

        GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(authorizedOnly)
                .setServerClientId(getString(R.string.default_web_client_id))
                .build();

        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build();

        credentialManager.getCredentialAsync(
                this,
                request,
                new CancellationSignal(),
                command -> mainHandler.post(command),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(@NonNull GetCredentialResponse result) {
                        signInInProgress = false;
                        handleCredential(result.getCredential());
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException error) {
                        signInInProgress = false;

                        if (error instanceof GetCredentialCancellationException) {
                            return;
                        }

                        if (authorizedOnly && error instanceof NoCredentialException) {
                            beginGoogleSignIn(false);
                            return;
                        }

                        if (authorizedOnly) {
                            beginGoogleSignIn(false);
                            return;
                        }

                        showLoginError(error);
                    }
                });
    }

    private void handleCredential(Credential credential) {
        try {
            if (credential instanceof CustomCredential customCredential
                    && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(customCredential.getType())) {
                GoogleIdTokenCredential googleCredential =
                        GoogleIdTokenCredential.createFrom(customCredential.getData());
                signIntoWebWithGoogleIdToken(googleCredential.getIdToken());
                return;
            }

            showLoginError(new IllegalStateException("지원되지 않는 Google 로그인 응답입니다."));
        } catch (Throwable error) {
            showLoginError(error);
        }
    }

    private void signIntoWebWithGoogleIdToken(String idToken) {
        if (webView == null || idToken == null || idToken.isBlank()) {
            showLoginError(new IllegalStateException("Google 로그인 토큰을 확인하지 못했습니다."));
            return;
        }

        String token = JSONObject.quote(idToken);
        String script =
                "(async function(){try{" +
                "var cfg=window.POKEMON_DEX_FIREBASE;" +
                "if(!cfg||!cfg.config)throw new Error('Firebase 설정을 찾지 못했습니다.');" +
                "var appModule=await import('https://www.gstatic.com/firebasejs/" + FIREBASE_JS_VERSION + "/firebase-app.js');" +
                "var authModule=await import('https://www.gstatic.com/firebasejs/" + FIREBASE_JS_VERSION + "/firebase-auth.js');" +
                "var app=appModule.getApps().length?appModule.getApp():appModule.initializeApp(cfg.config);" +
                "var auth=authModule.getAuth(app);" +
                "await authModule.setPersistence(auth,authModule.browserLocalPersistence);" +
                "var credential=authModule.GoogleAuthProvider.credential(" + token + ");" +
                "await authModule.signInWithCredential(auth,credential);" +
                "window.location.reload();" +
                "}catch(error){" +
                "console.error('Android Google 로그인 오류',error);" +
                "alert('Google 로그인에 실패했습니다.\\n'+(error&&error.message?error.message:error));" +
                "}})();";

        webView.evaluateJavascript(script, null);
    }

    private void beginSheetsAuthorization() {
        if (sheetsAuthorizationInProgress) return;

        if (!isTrustedWebPage()) {
            deliverSheetsAuthorizationError(
                    "native/untrusted-origin",
                    "안전한 앱 페이지에서만 Sheets 연결을 사용할 수 있습니다.");
            return;
        }

        sheetsAuthorizationInProgress = true;
        List<Scope> requestedScopes =
                Collections.singletonList(new Scope(SHEETS_SCOPE));
        AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(requestedScopes)
                .build();

        Identity.getAuthorizationClient(this)
                .authorize(request)
                .addOnSuccessListener(result -> {
                    if (result.hasResolution()) {
                        if (result.getPendingIntent() == null) {
                            deliverSheetsAuthorizationError(
                                    "native/missing-resolution",
                                    "Google Sheets 권한 화면을 열지 못했습니다.");
                            return;
                        }

                        try {
                            startIntentSenderForResult(
                                    result.getPendingIntent().getIntentSender(),
                                    SHEETS_AUTH_REQUEST_CODE,
                                    null,
                                    0,
                                    0,
                                    0);
                        } catch (IntentSender.SendIntentException error) {
                            deliverSheetsAuthorizationFailure(error);
                        }
                        return;
                    }

                    deliverSheetsAuthorizationResult(result);
                })
                .addOnFailureListener(this::deliverSheetsAuthorizationFailure);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != SHEETS_AUTH_REQUEST_CODE) return;

        if (resultCode != RESULT_OK || data == null) {
            deliverSheetsAuthorizationError(
                    "native/cancelled",
                    "Google Sheets 권한 연결을 취소했습니다.");
            return;
        }

        try {
            AuthorizationResult result = Identity.getAuthorizationClient(this)
                    .getAuthorizationResultFromIntent(data);
            deliverSheetsAuthorizationResult(result);
        } catch (ApiException error) {
            deliverSheetsAuthorizationFailure(error);
        }
    }

    private void deliverSheetsAuthorizationResult(AuthorizationResult result) {
        if (result == null || result.getAccessToken() == null
                || result.getAccessToken().isBlank()) {
            deliverSheetsAuthorizationError(
                    "native/missing-token",
                    "Google Sheets 접근 토큰을 받지 못했습니다.");
            return;
        }

        List<String> grantedScopes = result.getGrantedScopes();
        if (grantedScopes == null || !grantedScopes.contains(SHEETS_SCOPE)) {
            deliverSheetsAuthorizationError(
                    "native/missing-scope",
                    "Google Sheets 권한이 허용되지 않았습니다.");
            return;
        }

        sheetsAuthorizationInProgress = false;
        deliverSheetsAuthorizationPayload(
                "{ok:true,accessToken:" + JSONObject.quote(result.getAccessToken()) + "}");
    }

    private void deliverSheetsAuthorizationFailure(Throwable error) {
        String message = "Google Sheets 권한 연결에 실패했습니다.";
        if (error != null && error.getMessage() != null
                && !error.getMessage().isBlank()) {
            message += "\n" + error.getMessage();
        }
        deliverSheetsAuthorizationError("native/authorization-failed", message);
    }

    private void deliverSheetsAuthorizationError(String code, String message) {
        sheetsAuthorizationInProgress = false;
        deliverSheetsAuthorizationPayload(
                "{ok:false,code:" + JSONObject.quote(code)
                        + ",message:" + JSONObject.quote(message) + "}");
    }

    private void deliverSheetsAuthorizationPayload(String payload) {
        if (webView == null || !isTrustedWebPage()) return;

        String script =
                "(function(){" +
                "var callback=window.PokemonDexOwnerSheetsNativeResult;" +
                "if(typeof callback==='function')callback(" + payload + ");" +
                "})();";
        webView.evaluateJavascript(script, null);
    }

    private boolean isTrustedWebPage() {
        if (webView == null || webView.getUrl() == null) return false;

        try {
            Uri current = Uri.parse(webView.getUrl());
            return "https".equalsIgnoreCase(current.getScheme())
                    && HOME_HOST.equalsIgnoreCase(current.getHost());
        } catch (Throwable ignored) {
            return false;
        }
    }

    private void showLoginError(Throwable error) {
        String detail = error == null ? "알 수 없는 오류" : error.getClass().getSimpleName();
        if (error != null && error.getMessage() != null && !error.getMessage().isBlank()) {
            detail += ": " + error.getMessage();
        }
        Toast.makeText(this, "Google 로그인에 실패했습니다.\n" + detail, Toast.LENGTH_LONG).show();
    }

    private void applySafeAreaInsets(View root) {
        root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
            int left;
            int top;
            int right;
            int bottom;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets safeInsets = windowInsets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left = safeInsets.left;
                top = safeInsets.top;
                right = safeInsets.right;
                bottom = safeInsets.bottom;
            } else {
                left = windowInsets.getSystemWindowInsetLeft();
                top = windowInsets.getSystemWindowInsetTop();
                right = windowInsets.getSystemWindowInsetRight();
                bottom = windowInsets.getSystemWindowInsetBottom();
            }

            view.setPadding(left, top, right, bottom);
            return windowInsets;
        });
        root.requestApplyInsets();
    }

    private boolean isGoogleOrFirebaseAuthHost(String host) {
        if (host == null) return false;
        String normalized = host.toLowerCase();
        return normalized.equals("accounts.google.com")
                || normalized.equals(FIREBASE_AUTH_HOST)
                || normalized.equals(FIREBASE_WEB_HOST)
                || normalized.endsWith(".accounts.google.com");
    }

    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();

        if (scheme == null) return false;

        if (("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                && HOME_HOST.equalsIgnoreCase(host)) {
            return false;
        }

        if (("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                && isGoogleOrFirebaseAuthHost(host)) {
            if (webView != null) webView.stopLoading();
            beginGoogleSignIn(true);
            return true;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void showFatalError(Throwable error) {
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);

        TextView message = new TextView(this);
        message.setTextColor(Color.rgb(30, 30, 30));
        message.setBackgroundColor(Color.WHITE);
        message.setTextSize(16);
        message.setGravity(Gravity.CENTER);
        message.setPadding(48, 48, 48, 48);
        applySafeAreaInsets(message);

        String detail = error.getClass().getSimpleName();
        if (error.getMessage() != null && !error.getMessage().isBlank()) {
            detail += "\n" + error.getMessage();
        }
        message.setText("디지털 카드 바인더 앱을 시작하지 못했습니다.\n\n오류 화면을 캡처해서 알려주세요.\n\n" + detail);
        setContentView(message);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) {
            webView.saveState(outState);
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("DigitalCardBinderApp");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
