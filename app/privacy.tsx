import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppFooter } from "@/components/AppFooter";
import { theme } from "@/theme/theme";

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.heading}>FOR YOUR PRIVACY:</Text>
        <Text style={styles.body}>
          This app runs in your own browser. There are no accounts, no backend, and no syncing, so I can’t see who you
          are, what you search for, or which events you save.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subheading}>Here’s how it works:</Text>
        <Text style={styles.body}>
          The festival schedule is bundled into the app, so you can browse it even when connection is shaky. When you
          save events, those choices are stored only in your own browser using local storage. They are not sent to me or
          stored in a database.
        </Text>
        <Text style={styles.body}>
          Your saved events stay on the same device and browser unless you clear your site data, switch browser/device,
          or use a browser mode that blocks storage.
        </Text>
                <Text style={styles.subheading}>Please note:</Text>
        <Text style={styles.body}>
          The site does however use a small amount of google analytics, but I only track page views. This is to have an extra safety check for myself, to ensure that we are at a level of site visits that my hosting allows for free. I do not send custom analytics events for saved festival events, searches, filters, map interactions or anything else.  
        </Text>
      </View>
        <Text style={styles.subheading}>And finally</Text>
      <Text style={styles.body}>This page is made by Raviolan for Allie cat, queen of the timeline 🫶🏽💫</Text>

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
