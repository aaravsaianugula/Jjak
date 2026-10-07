package com.jjak.puzzle;

import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int PAPER = Color.parseColor("#F3ECDF");
    private static final int INK = Color.parseColor("#1C1B19");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        paintBackground();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Light/dark switched while the app is open (uiMode is handled in place, no restart).
        paintBackground();
    }

    /**
     * Paint the window and the WebView in the player's look before the page draws,
     * so a dark phone never flashes light paper (and a forced Paper/Ink choice in
     * Settings is honoured from the first frame). The page itself follows the same
     * choice through prefers-color-scheme and its own theme setting.
     */
    private void paintBackground() {
        boolean dark = isDark();
        int bg = dark ? INK : PAPER;
        getWindow().getDecorView().setBackgroundColor(bg);
        if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().setBackgroundColor(bg);
    }

    /** The saved theme ('paper' | 'ink' | 'auto') from the game's save, else the phone's setting. */
    private boolean isDark() {
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        try {
            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
            String json = prefs.getString("jjak.save.v1", null);
            if (json == null) return night;
            JSONObject settings = new JSONObject(json).optJSONObject("settings");
            String theme = settings != null ? settings.optString("theme", "auto") : "auto";
            if ("ink".equals(theme)) return true;
            if ("paper".equals(theme)) return false;
        } catch (Exception ignored) {
            // A missing or unreadable save just means "follow the phone".
        }
        return night;
    }
}
