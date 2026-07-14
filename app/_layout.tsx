import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { AppBackground } from "@/components/AppBackground";
import { BackToTopButton } from "@/components/BackToTopButton";
import { BottomShortcuts } from "@/components/BottomShortcuts";
import { theme } from "@/theme/theme";

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
    card: theme.surfaces.chrome,
    primary: theme.colors.text,
    text: theme.colors.text
  }
};

export default function RootLayout() {
  return (
    <View style={styles.shell}>
      <AppBackground />
      <View style={styles.content}>
        <StatusBar style="dark" />
        <ThemeProvider value={navigationTheme}>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: "transparent" },
              headerStyle: { backgroundColor: theme.surfaces.chrome },
              headerTitleStyle: { color: theme.colors.text, fontWeight: "900" },
              headerTintColor: theme.colors.text
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false, title: "JOMO 2.0" }} />
            <Stack.Screen name="saved" options={{ headerShown: false, title: "Saved events" }} />
            <Stack.Screen name="map/index" options={{ headerShown: false, title: "Map" }} />
            <Stack.Screen name="map/[square]" options={{ headerShown: false, title: "Grid square" }} />
            <Stack.Screen name="event/[id]" options={{ headerShown: false, title: "Event" }} />
            <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
          </Stack>
        </ThemeProvider>
      </View>
      <BackToTopButton />
      <BottomShortcuts />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    position: "relative",
    zIndex: 1
  },
  shell: {
    backgroundColor: "transparent",
    flex: 1,
    position: "relative"
  }
});
