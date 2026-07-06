import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme/theme";

interface UndoNoticeProps {
  label?: string;
  onUndo: () => void;
}

export function UndoNotice({ label, onUndo }: UndoNoticeProps) {
  if (!label) {
    return null;
  }

  return (
    <View style={styles.notice}>
      <Text style={styles.text}>{label}</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onUndo}>
        <Text style={styles.action}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900",
    textDecorationLine: "underline"
  },
  notice: {
    alignItems: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginHorizontal: theme.spacing.screenX,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  text: {
    color: theme.colors.textMuted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  }
});
