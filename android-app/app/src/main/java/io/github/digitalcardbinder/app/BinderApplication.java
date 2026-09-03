package io.github.digitalcardbinder.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BinderApplication extends Application implements Application.ActivityLifecycleCallbacks {
    public static final String NOTIFICATION_CHANNEL_ID = "updates";
    public static final String NOTIFICATION_TOPIC = "updates";

    private static final String PREFS_NAME = "digital_card_binder_app";
    private static final String PREF_NOTIFICATION_PROMPTED = "notification_prompted";
    private static final String PREF_LAST_UPDATE_CHECK = "last_update_check";
    private static final String PREF_DISMISSED_VERSION_CODE = "dismissed_version_code";
    private static final String PREF_DISMISSED_AT = "dismissed_at";
    private static final String VERSION_URL = "https://digital-card-binder.github.io/app-version.json";
    private static final long UPDATE_CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L;
    private static final long UPDATE_REMIND_INTERVAL_MS = 24L * 60L * 60L * 1000L;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 9031;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private boolean notificationPromptScheduled = false;
    private boolean updateCheckInProgress = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        registerActivityLifecycleCallbacks(this);
        subscribeToUpdatesTopic();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "새소식",
                NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("디지털 카드 바인더의 새소식과 주요 업데이트 알림");

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private void subscribeToUpdatesTopic() {
        try {
            FirebaseMessaging.getInstance()
                    .subscribeToTopic(NOTIFICATION_TOPIC)
                    .addOnFailureListener(error -> {
                        // 네트워크가 복구되면 Firebase SDK가 토큰/구독을 다시 시도할 수 있으므로
                        // 앱 실행 자체를 막지 않는다.
                    });
        } catch (Throwable ignored) {
            // Firebase 초기화 실패가 WebView 앱 실행까지 막지 않도록 격리한다.
        }
    }

    @Override
    public void onActivityResumed(Activity activity) {
        if (!(activity instanceof MainActivity)) return;
        maybePromptNotificationPermission(activity);
        maybeCheckForUpdate(activity);
    }

    private void maybePromptNotificationPermission(Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) return;

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (prefs.getBoolean(PREF_NOTIFICATION_PROMPTED, false) || notificationPromptScheduled) return;

        notificationPromptScheduled = true;
        mainHandler.postDelayed(() -> {
            notificationPromptScheduled = false;
            if (activity.isFinishing() || activity.isDestroyed()) return;
            if (activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED) return;

            new AlertDialog.Builder(activity)
                    .setTitle("새소식 알림 받기")
                    .setMessage("새 도감과 주요 업데이트가 올라오면 앱 알림으로 알려드릴까요?")
                    .setPositiveButton("알림 허용", (dialog, which) -> {
                        prefs.edit().putBoolean(PREF_NOTIFICATION_PROMPTED, true).apply();
                        activity.requestPermissions(
                                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                                NOTIFICATION_PERMISSION_REQUEST_CODE);
                    })
                    .setNegativeButton("지금은 안 함", (dialog, which) ->
                            prefs.edit().putBoolean(PREF_NOTIFICATION_PROMPTED, true).apply())
                    .setOnCancelListener(dialog ->
                            prefs.edit().putBoolean(PREF_NOTIFICATION_PROMPTED, true).apply())
                    .show();
        }, 900L);
    }

    private void maybeCheckForUpdate(Activity activity) {
        if (updateCheckInProgress) return;

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long lastCheck = prefs.getLong(PREF_LAST_UPDATE_CHECK, 0L);
        if (now - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;

        updateCheckInProgress = true;
        prefs.edit().putLong(PREF_LAST_UPDATE_CHECK, now).apply();

        executor.execute(() -> {
            try {
                JSONObject payload = fetchVersionPayload();
                int latestVersionCode = payload.optInt("versionCode", 0);
                if (latestVersionCode <= BuildConfig.VERSION_CODE) return;

                boolean required = payload.optBoolean("required", false);
                int dismissedVersionCode = prefs.getInt(PREF_DISMISSED_VERSION_CODE, 0);
                long dismissedAt = prefs.getLong(PREF_DISMISSED_AT, 0L);
                if (!required
                        && dismissedVersionCode == latestVersionCode
                        && now - dismissedAt < UPDATE_REMIND_INTERVAL_MS) {
                    return;
                }

                String versionName = payload.optString("versionName", "").trim();
                String message = payload.optString(
                        "message",
                        "새 버전이 준비되었습니다. 최신 버전으로 업데이트해 주세요.").trim();
                String apkUrl = payload.optString("apkUrl", "").trim();
                if (apkUrl.isEmpty()) return;

                mainHandler.post(() -> showUpdateDialog(
                        activity,
                        latestVersionCode,
                        versionName,
                        message,
                        apkUrl,
                        required));
            } catch (Throwable ignored) {
                // 업데이트 서버 확인 실패는 앱 사용을 방해하지 않는다.
            } finally {
                updateCheckInProgress = false;
            }
        });
    }

    private JSONObject fetchVersionPayload() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(VERSION_URL).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json");

        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("Version response: " + status);
            }

            StringBuilder content = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    content.append(line);
                }
            }
            return new JSONObject(content.toString());
        } finally {
            connection.disconnect();
        }
    }

    private void showUpdateDialog(
            Activity activity,
            int latestVersionCode,
            String versionName,
            String message,
            String apkUrl,
            boolean required) {
        if (activity.isFinishing() || activity.isDestroyed()) return;

        String title = versionName.isEmpty()
                ? "새 앱 버전이 있습니다"
                : "디지털 카드 바인더 v" + versionName;

        AlertDialog.Builder builder = new AlertDialog.Builder(activity)
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton("업데이트", (dialog, which) -> openApkUrl(activity, apkUrl));

        if (!required) {
            builder.setNegativeButton("나중에", (dialog, which) ->
                    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                            .edit()
                            .putInt(PREF_DISMISSED_VERSION_CODE, latestVersionCode)
                            .putLong(PREF_DISMISSED_AT, System.currentTimeMillis())
                            .apply());
        }

        AlertDialog dialog = builder.create();
        dialog.setCancelable(!required);
        dialog.setCanceledOnTouchOutside(!required);
        dialog.show();
    }

    private void openApkUrl(Context context, String apkUrl) {
        try {
            Uri uri = Uri.parse(apkUrl);
            if (!"https".equalsIgnoreCase(uri.getScheme())) return;
            context.startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Throwable ignored) {
            // 외부 다운로드 화면을 열지 못해도 현재 앱은 계속 사용할 수 있다.
        }
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
    }

    @Override
    public void onActivityStarted(Activity activity) {
    }

    @Override
    public void onActivityPaused(Activity activity) {
    }

    @Override
    public void onActivityStopped(Activity activity) {
    }

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle outState) {
    }

    @Override
    public void onActivityDestroyed(Activity activity) {
    }
}
