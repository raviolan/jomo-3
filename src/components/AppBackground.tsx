import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { theme } from "@/theme/theme";

const clouds = theme.colors.vaporwaveClouds;

const vaporwaveBackgroundImage = [
  `radial-gradient(circle at 18% 92%, rgba(${clouds.magentaRgb}, 0.72) 0%, transparent 42%)`,
  `radial-gradient(circle at 52% 84%, rgba(${clouds.electricVioletRgb}, 0.68) 0%, transparent 46%)`,
  `radial-gradient(circle at 92% 88%, rgba(${clouds.cyanRgb}, 0.72) 0%, transparent 44%)`,
  `radial-gradient(circle at 78% 12%, rgba(${clouds.roseRgb}, 0.72) 0%, transparent 42%)`,
  `radial-gradient(circle at 45% 8%, rgba(${clouds.peachRgb}, 0.7) 0%, transparent 46%)`,
  `radial-gradient(circle at 10% 6%, ${clouds.cream} 0%, rgba(247, 231, 207, 0.52) 24%, transparent 48%)`,
  `linear-gradient(135deg, ${clouds.mintCream} 0%, #f7c8b1 24%, ${clouds.rose} 46%, #8d2de2 72%, ${clouds.cyan} 100%)`
].join(", ");

const webBackgroundStyle: React.CSSProperties = {
  backgroundColor: theme.colors.backgroundBase,
  backgroundImage: vaporwaveBackgroundImage,
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "cover",
  height: "100vh",
  inset: 0,
  pointerEvents: "none",
  position: "fixed",
  width: "100vw",
  zIndex: 0
};

export function AppBackground() {
  if (Platform.OS === "web") {
    return React.createElement("div", {
      "aria-hidden": true,
      "data-jomo-background": "true",
      style: webBackgroundStyle
    });
  }

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.flatten([StyleSheet.absoluteFillObject, styles.base])}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.backgroundBase
  }
});
