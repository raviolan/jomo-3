import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme/theme";

export function AppFooter() {
  return (
    <View style={styles.shell}>
      <Text style={styles.text}>Made by Raviolan for Alicia, queen of the timeline 🫶🏽💫</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: theme.spacing.screenX,
    paddingTop: 14
  },
  text: {
    color: theme.colors.textOnDark,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "center"
  }
});
