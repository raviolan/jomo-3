import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { AppBackground } from "@/components/AppBackground";
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
            <Stack.Screen name="index" options={{ title: "JOMO 2.0" }} />
            <Stack.Screen name="saved" options={{ title: "Saved events" }} />
            <Stack.Screen name="event/[id]" options={{ title: "Event" }} />
          </Stack>
        </ThemeProvider>
      </View>
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
