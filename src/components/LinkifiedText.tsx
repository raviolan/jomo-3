import { Linking, StyleSheet, Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

import { theme } from "@/theme/theme";

interface LinkifiedTextProps {
  style?: StyleProp<TextStyle>;
  text: string;
}

interface TextPart {
  key: string;
  text: string;
  url?: string;
}

const urlPattern = /https?:\/\/\s*(?:www\.)?[^\s]+\.[^\s]+|www\.[^\s]+/gi;
const phoneNumberPattern = /\+\d(?:[\d\s()-]{6,}\d)/g;
const trailingUrlPunctuationPattern = /[.,)\]]+$/;

export function LinkifiedText({ style, text }: LinkifiedTextProps) {
  const parts = getLinkifiedTextParts(text);

  return (
    <Text style={style}>
      {parts.map((part) =>
        part.url ? (
          <Text
            accessibilityRole="link"
            key={part.key}
            onPress={() => {
              void Linking.openURL(part.url ?? "");
            }}
            style={styles.link}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={part.key}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

function getLinkifiedTextParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlPattern)) {
    const rawText = match[0];
    const matchIndex = match.index ?? 0;
    const normalizedUrl = normalizeUrl(rawText);

    if (!normalizedUrl) {
      continue;
    }

    if (matchIndex > lastIndex) {
      parts.push({
        key: `text-${lastIndex}`,
        text: text.slice(lastIndex, matchIndex)
      });
    }

    const trailingPunctuation = rawText.match(trailingUrlPunctuationPattern)?.[0] ?? "";
    const linkedText = trailingPunctuation ? rawText.slice(0, -trailingPunctuation.length) : rawText;

    parts.push({
      key: `link-${matchIndex}`,
      text: linkedText,
      url: normalizedUrl
    });

    if (trailingPunctuation) {
      parts.push({
        key: `text-${matchIndex + linkedText.length}`,
        text: trailingPunctuation
      });
    }

    lastIndex = matchIndex + rawText.length;
  }

  appendPhoneAwarePlainText(parts, text.slice(lastIndex), lastIndex);

  return parts.length > 0 ? parts : [{ key: "text-0", text }];
}

function appendPhoneAwarePlainText(parts: TextPart[], text: string, offset: number) {
  let lastIndex = 0;

  for (const match of text.matchAll(phoneNumberPattern)) {
    const rawText = match[0];
    const matchIndex = match.index ?? 0;
    const normalizedPhoneUrl = normalizePhoneUrl(rawText);

    if (!normalizedPhoneUrl) {
      continue;
    }

    if (matchIndex > lastIndex) {
      parts.push({
        key: `text-${offset + lastIndex}`,
        text: text.slice(lastIndex, matchIndex)
      });
    }

    parts.push({
      key: `link-${offset + matchIndex}`,
      text: rawText,
      url: normalizedPhoneUrl
    });

    lastIndex = matchIndex + rawText.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      key: `text-${offset + lastIndex}`,
      text: text.slice(lastIndex)
    });
  }
}

function normalizeUrl(rawText: string): string | undefined {
  const withoutTrailingPunctuation = rawText.replace(trailingUrlPunctuationPattern, "");
  const withoutSchemeWhitespace = withoutTrailingPunctuation.replace(/^(https?:\/\/)\s+/i, "$1");

  if (/^www\./i.test(withoutSchemeWhitespace)) {
    return `https://${withoutSchemeWhitespace}`;
  }

  if (/^https?:\/\/[^\s]+\.[^\s]+/i.test(withoutSchemeWhitespace)) {
    return withoutSchemeWhitespace;
  }

  return undefined;
}

function normalizePhoneUrl(rawText: string): string | undefined {
  const normalizedNumber = rawText.replace(/[^\d+]/g, "");
  return normalizedNumber.startsWith("+") && normalizedNumber.length >= 8 ? `sms:${normalizedNumber}` : undefined;
}

const styles = StyleSheet.create({
  link: {
    color: theme.colors.brand,
    textDecorationLine: "underline"
  }
});
