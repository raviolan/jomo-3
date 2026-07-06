import Svg, { Path } from "react-native-svg";

interface HeartIconProps {
  color: string;
  filled?: boolean;
  size?: number;
}

export function HeartIcon({ color, filled = false, size = 21 }: HeartIconProps) {
  return (
    <Svg fill={filled ? color : "none"} height={size} viewBox="0 0 24 24" width={size}>
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
