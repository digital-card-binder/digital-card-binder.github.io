package io.github.digitalcardbinder.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

public class MainActivity extends Activity {
    private static final String START_URL = "https://digital-card-binder.github.io/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        CustomTabColorSchemeParams colorParams = new CustomTabColorSchemeParams.Builder()
                .setToolbarColor(0xFFFFFFFF)
                .setNavigationBarColor(0xFFFFFFFF)
                .build();

        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(colorParams)
                .setShowTitle(false)
                .setUrlBarHidingEnabled(true)
                .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
                .build();

        customTabsIntent.launchUrl(this, Uri.parse(START_URL));
        finish();
    }
}
