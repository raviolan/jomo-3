import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppFooter } from "@/components/AppFooter";
import { theme } from "@/theme/theme";

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.heading}>FOR YOUR PRIVACY:</Text>
        <Text style={styles.body}>
          This page is fully running on your device’s local storage. There is no backend and no info is being sent to
          servers. That means that I’ll never be able to see who you are or what events you favorited. Your data is
          yours.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subheading}>Here’s how it works:</Text>
        <Text style={styles.body}>
          Each user’s saved events are stored only in that person’s own browser, using the browser’s local storage. The
          app saves small lists of everything going on at BL, and does not send anything to a server. The festival
          schedule itself is bundled with the app, so it can be browsed offline, and each user’s saved choices stay on
          their device/browser unless they clear site data, switch browsers/devices, or use a browser mode that blocks
          storage.
        </Text>
      </View>

      <Text style={styles.body}>This page is made by Raviolan for Alicia, queen of the timeline 🫶🏽💫</Text>

      <Text style={styles.body}>
        If you love this as much as we do, feel free to{" "}
        <Text
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL("https://ko-fi.com/dobbel");
          }}
          style={styles.link}
        >
          give me a tip via ko-fi.
        </Text>{" "}
        It powers projects like this for people like you&lt;3
      </Text>

      <AppFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 23
  },
  content: {
    gap: 18,
    marginHorizontal: "auto",
    maxWidth: 760,
    padding: theme.spacing.screenX,
    paddingBottom: theme.spacing.bottomNavPadding,
    width: "100%"
  },
  heading: {
    color: theme.colors.brand,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24
  },
  link: {
    color: theme.colors.brand,
    textDecorationLine: "underline"
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1
  },
  section: {
    gap: 8
  },
  subheading: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 23
  }
});
