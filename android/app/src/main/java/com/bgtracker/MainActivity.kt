package com.bgtracker

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Optional: Set a layout if needed
        // setContentView(R.layout.activity_main)

        // Start your background location service if needed
        // LocationService.start(this)
    }
}
