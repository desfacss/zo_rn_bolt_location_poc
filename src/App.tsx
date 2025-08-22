import React, { useEffect } from "react";
import {
  Button,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
} from "react-native";
import BackgroundFetch from "react-native-background-fetch";
import Geolocation from "react-native-geolocation-service";

async function requestLocationPermission() {
  if (Platform.OS === "android") {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

const App = () => {
  useEffect(() => {
    (async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        console.warn("❌ Location permission not granted");
        return;
      }

      // Configure BackgroundFetch
      BackgroundFetch.configure(
        {
          minimumFetchInterval: 15, // minutes
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
        },
        async (taskId) => {
          console.log("[BackgroundFetch] Event received:", taskId);

          Geolocation.getCurrentPosition(
            (pos) => {
              console.log(
                "📍 Foreground/Background location:",
                pos.coords.latitude,
                pos.coords.longitude
              );
            },
            (err) => console.warn("❌ Location error:", err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );

          BackgroundFetch.finish(taskId);
        },
        (error) => {
          console.error("[BackgroundFetch] Failed to start:", error);
        }
      );

      // Optional: check status
      const status = await BackgroundFetch.status();
      console.log("[BackgroundFetch] Status:", status);
    })();
  }, []);

  const getLocationNow = () => {
    Geolocation.getCurrentPosition(
      (pos) => {
        console.log(
          "📍 Manual location:",
          pos.coords.latitude,
          pos.coords.longitude
        );
      },
      (err) => console.warn("❌ Manual location error:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📍 Location Tracker</Text>
      <Button title="Get Location Now" onPress={getLocationNow} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
});

export default App;
