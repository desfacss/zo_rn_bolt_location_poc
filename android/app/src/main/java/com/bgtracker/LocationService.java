package com.bgtracker;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Criteria;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.facebook.react.HeadlessJsTaskService;

public class LocationService extends Service implements LocationListener {
    private static final String TAG = "LocationService";
    private static final String CHANNEL_ID = "bg_location_channel";

    // Config (can be overridden via start Intent extras)
    private long minTimeMs = 5 * 60 * 1000L; // 5 minutes
    private float minDistanceM = 10f; // 10 meters
    private String notifTitle = "Tracking location";
    private String notifText = "Background location is active";

    private LocationManager locationManager;
    private Location lastAccepted;
    private long lastAcceptedTs = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new NotificationCompat
                .Builder(this, CHANNEL_ID)
                .setContentTitle(notifTitle)
                .setContentText(notifText)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build();
        startForeground(1, notification);
        Log.d(TAG, "Service created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        readConfigFromIntent(intent);

        if (!hasLocationPermission()) {
            Log.w(TAG, "Missing location permission. Stopping service.");
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);

            // Use both providers for better coverage
            requestUpdates(LocationManager.GPS_PROVIDER);
            requestUpdates(LocationManager.NETWORK_PROVIDER);

            // Also try to seed lastAccepted with a last known value
            Location seed = getBestLastKnownLocation();
            if (seed != null) {
                maybeAccept(seed);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting location updates", e);
            stopSelf();
        }

        return START_STICKY;
    }

    private void requestUpdates(String provider) {
        if (locationManager == null) return;
        if (!locationManager.isProviderEnabled(provider)) return;

        try {
            locationManager.requestLocationUpdates(
                    provider,
                    minTimeMs,     // minimum time between callbacks
                    minDistanceM,  // minimum distance between callbacks
                    this
            );
            Log.d(TAG, "Requested updates from " + provider + " (minTime=" + minTimeMs + "ms, minDist=" + minDistanceM + "m)");
        } catch (SecurityException se) {
            Log.e(TAG, "SecurityException requesting updates", se);
        }
    }

    private void readConfigFromIntent(@Nullable Intent intent) {
        if (intent == null) return;
        if (intent.hasExtra("minTimeMs")) {
            minTimeMs = intent.getLongExtra("minTimeMs", minTimeMs);
        }
        if (intent.hasExtra("minDistanceM")) {
            minDistanceM = intent.getFloatExtra("minDistanceM", minDistanceM);
        }
        if (intent.hasExtra("notifTitle")) {
            notifTitle = intent.getStringExtra("notifTitle");
        }
        if (intent.hasExtra("notifText")) {
            notifText = intent.getStringExtra("notifText");
        }
    }

    private boolean hasLocationPermission() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean bg = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            bg = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
        return (fine || coarse) && bg;
    }

    @Nullable
    private Location getBestLastKnownLocation() {
        try {
            Location gps = null, net = null;
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                gps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                net = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            if (gps != null && net != null) {
                return gps.getTime() >= net.getTime() ? gps : net;
            }
            return gps != null ? gps : net;
        } catch (SecurityException e) {
            return null;
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        maybeAccept(location);
    }

    private void maybeAccept(Location loc) {
        long now = System.currentTimeMillis();

        if (lastAccepted == null) {
            lastAccepted = loc;
            lastAcceptedTs = now;
            emitToHeadless(loc, "seed");
            return;
        }

        float distance = loc.distanceTo(lastAccepted);
        long deltaT = now - lastAcceptedTs;

        // Require BOTH: time >= minTimeMs AND distance >= minDistanceM
        if (deltaT >= minTimeMs && distance >= minDistanceM) {
            lastAccepted = loc;
            lastAcceptedTs = now;
            emitToHeadless(loc, "interval");
        } else {
            Log.d(TAG, "Ignored location. Δt=" + deltaT + "ms Δd=" + distance + "m");
        }
    }

    private void emitToHeadless(Location loc, String reason) {
        Intent headlessIntent = new Intent(getApplicationContext(), LocationEventService.class);
        headlessIntent.putExtra("latitude", loc.getLatitude());
        headlessIntent.putExtra("longitude", loc.getLongitude());
        headlessIntent.putExtra("accuracy", loc.hasAccuracy() ? loc.getAccuracy() : -1f);
        headlessIntent.putExtra("provider", loc.getProvider());
        headlessIntent.putExtra("time", loc.getTime());
        headlessIntent.putExtra("reason", reason);
        getApplicationContext().startService(headlessIntent);
        HeadlessJsTaskService.acquireWakeLockNow(getApplicationContext());
        Log.d(TAG, "Emitted to HeadlessJS (" + reason + ")");
    }

    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (SecurityException ignored) { }
        }
        Log.d(TAG, "Service destroyed");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Background Location",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }
}
