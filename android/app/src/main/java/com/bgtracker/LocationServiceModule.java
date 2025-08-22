package com.bgtracker;

import android.Manifest;
import android.content.Intent;
import android.location.Criteria;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import android.content.pm.PackageManager;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

import java.util.concurrent.atomic.AtomicBoolean;

public class LocationServiceModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public LocationServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override public String getName() { return "LocationServiceModule"; }

    private boolean hasBackgroundPermission() {
        boolean fine = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean bg = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            bg = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
        return (fine || coarse) && bg;
    }

    @ReactMethod
    public void startService(@Nullable ReadableMap options, Promise promise) {
        if (!hasBackgroundPermission()) {
            promise.reject("PERMISSION", "Location permissions (including background) are not granted.");
            return;
        }

        Intent i = new Intent(reactContext, LocationService.class);
        if (options != null) {
            if (options.hasKey("minTimeMs")) i.putExtra("minTimeMs", (long) options.getDouble("minTimeMs"));
            if (options.hasKey("minDistanceM")) i.putExtra("minDistanceM", (float) options.getDouble("minDistanceM"));
            if (options.hasKey("notifTitle")) i.putExtra("notifTitle", options.getString("notifTitle"));
            if (options.hasKey("notifText")) i.putExtra("notifText", options.getString("notifText"));
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(i);
        } else {
            reactContext.startService(i);
        }
        promise.resolve(true);
    }

    @ReactMethod
    public void stopService(Promise promise) {
        Intent i = new Intent(reactContext, LocationService.class);
        boolean stopped = reactContext.stopService(i);
        promise.resolve(stopped);
    }

    @ReactMethod
    public void getCurrentLocation(final Promise promise) {
        if (!hasBackgroundPermission()) {
            promise.reject("PERMISSION", "Location permissions not granted.");
            return;
        }

        final LocationManager lm = (LocationManager) reactContext.getSystemService(ReactApplicationContext.LOCATION_SERVICE);

        // Try best last known first
        try {
            Location gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            Location net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            Location best = null;
            if (gps != null && net != null) best = gps.getTime() >= net.getTime() ? gps : net;
            else best = gps != null ? gps : net;

            if (best != null && (System.currentTimeMillis() - best.getTime()) < 2 * 60 * 1000L) {
                promise.resolve(locationToMap(best));
                return;
            }
        } catch (SecurityException ignored) {}

        // Fall back to single update
        final AtomicBoolean done = new AtomicBoolean(false);
        final LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                if (done.getAndSet(true)) return;
                try { lm.removeUpdates(this); } catch (SecurityException ignored) {}
                promise.resolve(locationToMap(location));
            }
            @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
            @Override public void onProviderEnabled(String provider) { }
            @Override public void onProviderDisabled(String provider) { }
        };

        try {
            Criteria c = new Criteria();
            c.setAccuracy(Criteria.ACCURACY_FINE);
            String provider = lm.getBestProvider(c, true);
            if (provider == null) provider = LocationManager.GPS_PROVIDER;

            lm.requestSingleUpdate(provider, listener, null);

            // safety timeout 15s
            final String p = provider;
            new android.os.Handler(reactContext.getMainLooper()).postDelayed(() -> {
                if (done.getAndSet(true)) return;
                try { lm.removeUpdates(listener); } catch (SecurityException ignored) {}
                promise.reject("TIMEOUT", "Timed out waiting for single location from " + p);
            }, 15000);
        } catch (SecurityException se) {
            promise.reject("SECURITY", se);
        } catch (Exception e) {
            promise.reject("ERROR", e);
        }
    }

    private com.facebook.react.bridge.WritableMap locationToMap(Location l) {
        com.facebook.react.bridge.WritableMap m = Arguments.createMap();
        m.putDouble("latitude", l.getLatitude());
        m.putDouble("longitude", l.getLongitude());
        m.putDouble("accuracy", l.hasAccuracy() ? l.getAccuracy() : -1);
        m.putString("provider", l.getProvider());
        m.putDouble("time", l.getTime());
        return m;
    }
}
