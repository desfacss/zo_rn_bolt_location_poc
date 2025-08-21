import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  StatusBar,
  PermissionsAndroid,
} from 'react-native';
import { WebView } from 'react-native-webview';
import BackgroundGeolocation from 'react-native-background-geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createClient } from '@supabase/supabase-js';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTROL_BAR_HEIGHT = 120;

// Supabase configuration (replace with your actual values)
const SUPABASE_URL = 'https://gbhktobgplalpjmfoyte.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiaGt0b2JncGxhbHBqbWZveXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMTk5NzksImV4cCI6MjA2NTg5NTk3OX0.JmJM1gkklc8m8rh3tNjXxdUjQ0Yw_Vb3Vx_cdu04zCg';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface LocationData {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  deviceId: string;
  synced: boolean;
}

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [pendingLocations, setPendingLocations] = useState<LocationData[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  const locationQueueRef = useRef<LocationData[]>([]);

  useEffect(() => {
    initializeApp();
    setupNetworkListener();
    configureBackgroundGeolocation();

    return () => {
      BackgroundGeolocation.removeAllListeners();
    };
  }, []);

  const initializeApp = async () => {
    await initializeDeviceId();
    await loadStoredLocations();
  };

  const initializeDeviceId = async () => {
    try {
      let storedDeviceId = await AsyncStorage.getItem('deviceId');
      if (!storedDeviceId) {
        storedDeviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('deviceId', storedDeviceId);
      }
      setDeviceId(storedDeviceId);
    } catch (error) {
      console.error('Error initializing device ID:', error);
    }
  };

  const loadStoredLocations = async () => {
    try {
      const storedLocations = await AsyncStorage.getItem('pendingLocations');
      if (storedLocations) {
        const locations = JSON.parse(storedLocations);
        locationQueueRef.current = locations;
        setPendingLocations(locations);
        console.log(`Loaded ${locations.length} pending locations`);
      }
    } catch (error) {
      console.error('Error loading stored locations:', error);
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
      if (state.isConnected && locationQueueRef.current.length > 0) {
        syncPendingData();
      }
    });

    return unsubscribe;
  };

  const configureBackgroundGeolocation = () => {
    BackgroundGeolocation.ready({
      // Geolocation Config
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10, // 10 meters
      
      // Activity Recognition
      stopTimeout: 1,
      
      // Application config
      debug: __DEV__, // Enable debug sounds in development
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
      enableHeadless: true,
      
      // HTTP / SQLite config
      autoSync: false, // We'll handle sync manually
      batchSync: false,
      maxBatchSize: 50,
      
      // Background Task Config
      backgroundPermissionRationale: {
        title: "Allow Location Access",
        message: "This app needs background location access to track your position even when the app is closed.",
        positiveAction: 'Change to "Allow all the time"',
        negativeAction: 'Cancel'
      },
      
      // Geofencing config (not used but required)
      url: '', // We'll handle HTTP manually
      
      // Android specific
      locationAuthorizationRequest: 'Always',
      backgroundPermissionRationale: {
        title: "Allow Location Access",
        message: "This app needs background location access to track your position.",
        positiveAction: 'Change to "Allow all the time"',
        negativeAction: 'Cancel'
      },
      
      // iOS specific
      preventSuspend: true,
      heartbeatInterval: 60,
      
    }, (state) => {
      console.log('BackgroundGeolocation ready: ', state);
      setIsTracking(state.enabled);
    });

    // Location event listener
    BackgroundGeolocation.onLocation(location => {
      console.log('Location received: ', location);
      
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setCurrentLocation(newLocation);
      saveLocationData(location);
    }, error => {
      console.error('Location error: ', error);
    });

    // Motion change event
    BackgroundGeolocation.onMotionChange(event => {
      console.log('Motion change: ', event);
    });

    // HTTP event (for debugging sync)
    BackgroundGeolocation.onHttp(response => {
      console.log('HTTP response: ', response);
    });

    // Heartbeat event
    BackgroundGeolocation.onHeartbeat(params => {
      console.log('Heartbeat: ', params);
    });
  };

  const saveLocationData = async (location: any) => {
    const locationData: LocationData = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      deviceId: deviceId,
      synced: false,
    };

    // Add to queue
    locationQueueRef.current.push(locationData);
    setPendingLocations([...locationQueueRef.current]);

    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem('pendingLocations', JSON.stringify(locationQueueRef.current));
      console.log('Location saved locally:', locationData);
    } catch (error) {
      console.error('Error saving location locally:', error);
    }

    // Try to sync immediately if online
    if (isOnline) {
      await syncPendingData();
    }
  };

  const syncPendingData = async () => {
    if (locationQueueRef.current.length === 0) return;

    try {
      console.log(`Syncing ${locationQueueRef.current.length} locations to Supabase...`);
      
      // Insert locations to Supabase
      const { data, error } = await supabase
        .from('locations')
        .insert(locationQueueRef.current.map(loc => ({
          device_id: loc.deviceId,
          latitude: loc.latitude,
          longitude: loc.longitude,
          timestamp: new Date(loc.timestamp).toISOString(),
        })));

      if (error) {
        console.error('Supabase sync error:', error);
        return;
      }

      // Clear synced data
      locationQueueRef.current = [];
      setPendingLocations([]);
      await AsyncStorage.setItem('pendingLocations', '[]');
      
      console.log('All locations synced successfully');
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        ]);

        const fineLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted';
        const backgroundLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION] === 'granted';

        if (!fineLocationGranted) {
          Alert.alert('Permission Required', 'Location permission is required for tracking.');
          return false;
        }

        if (!backgroundLocationGranted) {
          Alert.alert(
            'Background Permission Required',
            'For continuous tracking, please allow "All the time" location access in the next screen.',
            [{ text: 'OK' }]
          );
        }

        return fineLocationGranted;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const startTracking = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      await BackgroundGeolocation.start();
      setIsTracking(true);
      console.log('Background geolocation started');
    } catch (error) {
      console.error('Error starting background geolocation:', error);
      Alert.alert('Error', 'Failed to start location tracking.');
    }
  };

  const stopTracking = async () => {
    try {
      await BackgroundGeolocation.stop();
      setIsTracking(false);
      setCurrentLocation(null);
      console.log('Background geolocation stopped');
    } catch (error) {
      console.error('Error stopping background geolocation:', error);
    }
  };

  const handleTrackingToggle = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* WebView Container */}
      <View style={styles.webViewContainer}>
        <WebView
          source={{ uri: 'https://www.google.com' }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          allowsBackForwardNavigationGestures={true}
        />
      </View>

      {/* Control Bar */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.button, isTracking ? styles.stopButton : styles.startButton]}
          onPress={handleTrackingToggle}
        >
          <Text style={styles.buttonText}>
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <View style={styles.locationDisplay}>
            <Text style={styles.locationLabel}>Current Location:</Text>
            {currentLocation ? (
              <>
                <Text style={styles.locationText}>
                  Lat: {currentLocation.latitude.toFixed(6)}
                </Text>
                <Text style={styles.locationText}>
                  Lng: {currentLocation.longitude.toFixed(6)}
                </Text>
              </>
            ) : (
              <Text style={styles.locationPlaceholder}>...</Text>
            )}
          </View>

          <View style={styles.statusInfo}>
            <Text style={styles.statusText}>
              Queue: {pendingLocations.length} pending
            </Text>
            <Text style={styles.statusText}>
              Network: {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Text style={styles.deviceIdText}>
              Device: {deviceId.substring(0, 12)}...
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webViewContainer: {
    flex: 1,
    height: SCREEN_HEIGHT - CONTROL_BAR_HEIGHT,
  },
  webView: {
    flex: 1,
  },
  controlBar: {
    height: CONTROL_BAR_HEIGHT,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#007AFF',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationDisplay: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 11,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  locationPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  statusInfo: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 10,
    color: '#666',
  },
  deviceIdText: {
    fontSize: 9,
    color: '#999',
    marginTop: 2,
  },
});