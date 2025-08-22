/**
 * @format
 */
import { AppRegistry } from "react-native";
import BackgroundFetch from "react-native-background-fetch";
import Geolocation from "react-native-geolocation-service";
import App from "./App";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);

// Register Headless Task for Android
const backgroundFetchHeadlessTask = async (event) => {
  console.log("[BackgroundFetch HeadlessTask] start:", event.taskId);

  // Capture one location
  Geolocation.getCurrentPosition(
    (pos) => {
      console.log(
        "📍 Headless location:",
        pos.coords.latitude,
        pos.coords.longitude
      );
    },
    (err) => console.warn("❌ Headless location error:", err),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  BackgroundFetch.finish(event.taskId);
};

BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);
