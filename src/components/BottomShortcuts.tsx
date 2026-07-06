import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { requestHomeScrollToTop } from "@/lib/homeScrollEvents";
import { theme } from "@/theme/theme";

const shortcuts = [
  {
    href: "/",
    label: "Home",
    icon: HomeIcon,
    isActive: (pathname: string, view: string | undefined) => pathname === "/" && view !== "camps"
  },
  {
    href: "/saved",
    label: "Saved",
    icon: HeartIcon,
    isActive: (pathname: string) => pathname === "/saved"
  },
  {
    href: "/?view=camps",
    label: "Camps",
    icon: TentIcon,
    isActive: (pathname: string, view: string | undefined) => pathname === "/" && view === "camps"
  }
] as const;

export function BottomShortcuts() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ view?: string }>();
  const router = useRouter();

  return (
    <View style={styles.shell}>
      <View style={styles.row}>
        {shortcuts.map((shortcut) => {
          const active = shortcut.isActive(pathname, params.view);
          const Icon = shortcut.icon;
          const itemStyle = StyleSheet.flatten([styles.item, active ? styles.itemActive : null]);
          const labelStyle = StyleSheet.flatten([styles.label, active ? styles.labelActive : null]);

          return (
            <Pressable
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              key={shortcut.href}
              onPress={() => {
                if (shortcut.href === "/" && pathname === "/" && params.view !== "camps") {
                  requestHomeScrollToTop();
                  return;
                }

                router.push(shortcut.href);
              }}
              style={itemStyle}
            >
              <Icon color={active ? theme.colors.textOnDark : theme.colors.text} />
              <Text style={labelStyle}>{shortcut.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg fill="none" height={21} viewBox="0 0 24 24" width={21}>
      <Path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </Svg>
  );
}

function HeartIcon({ color }: { color: string }) {
  return (
    <Svg fill="none" height={21} viewBox="0 0 24 24" width={21}>
      <Path
        d="M12 20s-7-4.4-9.1-8.2C1.3 8.7 3.1 5 6.6 5c2 0 3.4 1 4.2 2.3C11.6 6 13 5 15.4 5c3.5 0 5.3 3.7 3.7 6.8C17 15.6 12 20 12 20Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </Svg>
  );
}

function TentIcon({ color }: { color: string }) {
  return (
    <Svg fill="none" height={21} viewBox="0 0 24 24" width={21}>
      <Path
        d="M4 20 12 5l8 15H4Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <Path d="M12 5v15M8.5 20 12 13l3.5 7" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  itemActive: {
    backgroundColor: theme.colors.brandDark
  },
  label: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  labelActive: {
    color: theme.colors.textOnDark
  },
  row: {
    alignSelf: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    maxWidth: 520,
    padding: 6,
    width: "100%"
  },
  shell: {
    backgroundColor: "rgba(247, 216, 210, 0.72)",
    borderTopColor: theme.colors.borderSoft,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
    position: "absolute",
    right: 0,
    zIndex: 2
  }
});
