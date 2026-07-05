import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme/theme";

interface EmptyStateProps {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center"
  },
  empty: {
    alignItems: "center",
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 22
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  }
});
