# React Native Location Tracker

A React Native application that provides persistent background location tracking with offline data handling and WebView integration.

## Features

- **Full-screen WebView**: Displays web applications (currently Google homepage)
- **Background Location Tracking**: Continuous location tracking even when app is closed
- **Offline Data Storage**: Stores location data locally when offline
- **Automatic Sync**: Syncs data to Supabase when online
- **Distance Filtering**: Only saves locations when user moves 10+ meters
- **Battery Optimization**: Intelligent tracking to preserve battery life

## Setup Instructions

### Prerequisites

- Node.js (>= 18)
- React Native development environment
- Android Studio (for Android)
- Xcode (for iOS)

### Installation

1. Install dependencies:

```bash
npm install
```

2. For iOS, install CocoaPods dependencies:

```bash
cd ios && pod install && cd ..
```

3. Configure Supabase:
   - Create a Supabase project
   - Create a `locations` table with columns: `id`, `device_id`, `latitude`, `longitude`, `timestamp`
   - Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `src/App.tsx`

### Running the App

For Android:

```bash
npm run android
```

For iOS:

```bash
npm run ios
```

## Permissions

The app requires the following permissions:

### Android

- `ACCESS_FINE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_LOCATION`
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

### iOS

- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- Background modes: `location`, `background-fetch`

## Architecture

- **WebView**: Full-screen web application container
- **Background Geolocation**: Uses `react-native-background-geolocation` for robust tracking
- **Local Storage**: AsyncStorage for offline data persistence
- **Network Detection**: Automatic sync when connectivity is restored
- **Supabase Integration**: Cloud database for location data storage

## Key Libraries

- `react-native-background-geolocation`: Enterprise-grade background location tracking
- `react-native-webview`: WebView component for displaying web content
- `@supabase/supabase-js`: Supabase client for database operations
- `@react-native-async-storage/async-storage`: Local data persistence
- `@react-native-community/netinfo`: Network connectivity detection

## Configuration

The background geolocation service is configured with:

- 10-meter distance filter
- High accuracy GPS
- 1-minute heartbeat interval
- Automatic battery optimization handling

## Production Considerations

1. **Supabase Setup**: Configure proper database schema and RLS policies
2. **API Keys**: Store sensitive keys securely (consider react-native-keychain)
3. **Error Handling**: Implement comprehensive error handling and logging
4. **Testing**: Test thoroughly on various devices and Android versions
5. **App Store**: Ensure compliance with location tracking policies

## Troubleshooting

- **Background tracking not working**: Ensure all permissions are granted and battery optimization is disabled
- **Sync issues**: Check network connectivity and Supabase configuration
- **Build errors**: Ensure all native dependencies are properly linked

## License

This project is for demonstration purposes. Check individual package licenses for production use.
