import { createTheme } from "@mui/material/styles";

export const nanaColors = {
  blue: "#2563eb",
  blueSoft: "#dbeafe",
  cyan: "#06b6d4",
  green: "#16a34a",
  greenSoft: "#dcfce7",
  amber: "#f59e0b",
  amberSoft: "#ffedd5",
  rose: "#e11d48",
  roseSoft: "#ffe4e6",
  surface: "#ffffff",
  surfaceMuted: "#eef2f8",
  surfaceAlt: "#f8fafc",
  bg: "#f7f8fb",
  ink: "#0f172a",
  muted: "#64748b",
  line: "#dbe2ef",
};

export const nanaTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: nanaColors.blue,
      light: "#5b8cff",
      dark: "#1d4ed8",
      contrastText: "#ffffff",
    },
    secondary: {
      main: nanaColors.green,
      light: "#34d399",
      dark: "#15803d",
      contrastText: "#ffffff",
    },
    background: {
      default: nanaColors.bg,
      paper: nanaColors.surface,
    },
    text: {
      primary: nanaColors.ink,
      secondary: nanaColors.muted,
    },
  },
  shape: {
    borderRadius: 22,
  },
  typography: {
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    h1: { fontWeight: 850, letterSpacing: "-0.04em" },
    h2: { fontWeight: 850, letterSpacing: "-0.035em" },
    h3: { fontWeight: 840, letterSpacing: "-0.03em" },
    button: { fontWeight: 800, textTransform: "none" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: "none",
          transition: "transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms cubic-bezier(0.2, 0, 0, 1)",
          "&:active": {
            transform: "translateY(1px) scale(0.98)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: `1px solid ${nanaColors.line}`,
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
          backgroundImage:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92))",
          backdropFilter: "blur(6px)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          borderRadius: 10,
        },
      },
    },
  },
});
