import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

import { HeartIcon } from "@/components/HeartIcon";
import { requestScrollToTop } from "@/lib/scrollToTopEvents";
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
    icon: SavedIcon,
    isActive: (pathname: string) => pathname === "/saved"
  },
  {
    href: "/?view=camps",
    label: "Camps",
    icon: TentIcon,
    isActive: (pathname: string, view: string | undefined) => pathname === "/" && view === "camps"
  },
  {
    href: "/map",
    label: "Map",
    icon: MapIcon,
    isActive: (pathname: string) => pathname === "/map" || pathname.startsWith("/map/")
  }
] as const;

export function BottomShortcuts() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ view?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 420;

  return (
    <View style={styles.shell}>
      <View style={[styles.row, isCompactLayout && styles.rowCompact]}>
        {shortcuts.map((shortcut) => {
          const active = shortcut.isActive(pathname, params.view);
          const Icon = shortcut.icon;
          const itemStyle = StyleSheet.flatten([
            styles.item,
            isCompactLayout && styles.itemCompact,
            active ? styles.itemActive : null
          ]);
          const labelStyle = StyleSheet.flatten([
            styles.label,
            isCompactLayout && styles.labelCompact,
            active ? styles.labelActive : null
          ]);

          return (
            <Pressable
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              key={shortcut.href}
              onPress={() => {
                if (shortcut.href === "/" && pathname === "/" && params.view !== "camps") {
                  requestScrollToTop();
                  return;
                }

                router.push(shortcut.href);
              }}
              style={itemStyle}
            >
              <View style={styles.iconSlot}>
                <Icon color={active ? theme.colors.textOnDark : theme.colors.text} />
              </View>
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

function SavedIcon({ color }: { color: string }) {
  return <HeartIcon color={color} />;
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

function MapIcon({ color }: { color: string }) {
  return (
    <Svg fill="none" height={21} viewBox="0 0 24 24" width={21}>
      <Path
        d="m9 18-5 2V6l5-2 6 2 5-2v14l-5 2-6-2Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <Path d="M9 4v14M15 6v14" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
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
  itemCompact: {
    flexDirection: "column",
    gap: 4,
    minHeight: 56,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  itemActive: {
    backgroundColor: theme.colors.brandDark
  },
  iconSlot: {
    alignItems: "center",
    flexShrink: 0,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  label: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900",
    minWidth: 0
  },
  labelActive: {
    color: theme.colors.textOnDark
  },
  labelCompact: {
    fontSize: 12,
    lineHeight: 14,
    textAlign: "center"
  },
  row: {
    alignSelf: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    maxWidth: 520,
    padding: 6,
    width: "100%"
  },
  rowCompact: {
    gap: 2,
    padding: 4
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
