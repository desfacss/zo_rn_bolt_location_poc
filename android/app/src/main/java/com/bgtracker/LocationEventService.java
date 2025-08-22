package com.bgtracker;

import android.content.Intent;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

import javax.annotation.Nullable;

public class LocationEventService extends HeadlessJsTaskService {
    @Nullable
    @Override
    protected HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        WritableMap data = Arguments.createMap();
        if (intent != null && intent.getExtras() != null) {
            for (String key : intent.getExtras().keySet()) {
                Object v = intent.getExtras().get(key);
                if (v instanceof Double) data.putDouble(key, (Double) v);
                else if (v instanceof Float) data.putDouble(key, ((Float) v));
                else if (v instanceof Integer) data.putInt(key, (Integer) v);
                else if (v instanceof Long) data.putDouble(key, ((Long) v).doubleValue());
                else if (v instanceof Boolean) data.putBoolean(key, (Boolean) v);
                else if (v instanceof String) data.putString(key, (String) v);
            }
        }
        // 10s timeout; allowed in foreground
        return new HeadlessJsTaskConfig("LocationEvent", data, 10000, true);
    }
}
