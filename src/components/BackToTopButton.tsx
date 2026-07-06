import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

import { requestScrollToTop } from "@/lib/scrollToTopEvents";
import { theme } from "@/theme/theme";

export function BackToTopButton() {
  return (
    <Pressable
      accessibilityLabel="Back to top"
      accessibilityRole="button"
      onPress={requestScrollToTop}
      style={styles.button}
    >
      <Svg fill="none" height={22} viewBox="0 0 24 24" width={22}>
        <Path
          d="M12 19V5M6 11l6-6 6 6"
          stroke={theme.colors.textOnDark}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.brandDark,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    bottom: theme.spacing.bottomNavPadding - 8,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    width: 44,
    zIndex: 3
  }
});
