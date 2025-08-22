package com.bgtracker

import android.app.Application

class MainApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        // Initialize your services or any libraries here
        // Example: LocationService.init(this)
    }
}
