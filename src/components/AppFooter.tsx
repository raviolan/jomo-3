import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme/theme";

export function AppFooter() {
  return (
    <View style={styles.shell}>
      <Text style={styles.text}>Made by Raviolan for Alicia, queen of the timeline 🫶🏽💫</Text>
      <Text style={styles.text}>
        I'm a solo dev, and{" "}
        <Link href="/privacy" asChild>
          <Text accessibilityRole="link" style={styles.link}>
            here's how your privacy is ensured.
          </Text>
        </Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 2,
    paddingHorizontal: theme.spacing.screenX,
    paddingTop: 14
  },
  link: {
    color: theme.colors.textOnDark,
    textDecorationLine: "underline"
  },
  text: {
    color: theme.colors.textOnDark,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "center"
  }
});
