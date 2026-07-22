/* One token system, light and dark, end to end. */
export const TOKENS = {
  light: {
    bg: "#F5F5F5", surface: "#FFFFFF", surface2: "#FAFAFA",
    border: "#E6E6E6", borderSoft: "#EFEFEF",
    text: "#1E1E1E", text2: "#757575", text3: "#9E9E9E",
    accent: "#0D99FF", accentBg: "#E5F4FF",
    green: "#14AE5C", greenBg: "#E6F9EE",
    red: "#F24822", redBg: "#FFEFEC",
    amber: "#B45309", amberBg: "#FFF4E5", amberBar: "#FFA629",
    purple: "#9747FF", purpleBg: "#F5EDFF",
    cyan: "#00A2C2", cyanBg: "#E4F7FB",
    track: "#EDEDED", hover: "#F2F8FD", shadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  dark: {
    bg: "#1B1B1B", surface: "#262626", surface2: "#2C2C2C",
    border: "#3A3A3A", borderSoft: "#333333",
    text: "#FFFFFF", text2: "#B3B3B3", text3: "#8A8A8A",
    accent: "#4DB8FF", accentBg: "#12314A",
    green: "#3DDC84", greenBg: "#143526",
    red: "#FF7059", redBg: "#43221C",
    amber: "#FFC66B", amberBg: "#3E2E14", amberBar: "#FFA629",
    purple: "#B98AFF", purpleBg: "#31234A",
    cyan: "#4FD4EE", cyanBg: "#123A44",
    track: "#3A3A3A", hover: "#2E3A44", shadow: "0 1px 3px rgba(0,0,0,0.4)",
  },
} as const;

export type Mode = keyof typeof TOKENS;
export type Theme = (typeof TOKENS)["light"];
