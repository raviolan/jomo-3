import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppFooter } from "@/components/AppFooter";
import { CampMap } from "@/components/CampMap";
import type { GridSquareRef } from "@/models/schedule";
import { theme } from "@/theme/theme";

export default function MapScreen() {
  const router = useRouter();

  function openGridSquare(square: GridSquareRef) {
    router.push(`/map/${square.key}`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>Tap a grid square to see events happening there.</Text>
      </View>

      <CampMap highlightedSquares={[]} interactiveSquares="all" onGridSquarePress={openGridSquare} />
      <AppFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    marginHorizontal: "auto",
    maxWidth: 900,
    padding: theme.spacing.screenX,
    paddingBottom: theme.spacing.bottomNavPadding,
    width: "100%"
  },
  header: {
    gap: 6
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 21
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39
  }
});
