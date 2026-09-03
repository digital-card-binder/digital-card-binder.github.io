package io.github.digitalcardbinder.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class DigitalCardBinderMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        FirebaseMessaging.getInstance().subscribeToTopic(BinderApplication.NOTIFICATION_TOPIC);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);

        String title = "디지털 카드 바인더";
        String body = "새로운 소식이 있습니다.";

        if (message.getNotification() != null) {
            if (message.getNotification().getTitle() != null
                    && !message.getNotification().getTitle().isBlank()) {
                title = message.getNotification().getTitle();
            }
            if (message.getNotification().getBody() != null
                    && !message.getNotification().getBody().isBlank()) {
                body = message.getNotification().getBody();
            }
        }

        String dataTitle = message.getData().get("title");
        String dataBody = message.getData().get("body");
        if (dataTitle != null && !dataTitle.isBlank()) title = dataTitle;
        if (dataBody != null && !dataBody.isBlank()) body = dataBody;

        Intent launchIntent = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new Notification.Builder(
                this,
                BinderApplication.NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build();

        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification);
        }
    }
}
