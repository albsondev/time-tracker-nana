import { createTheme } from "@mui/material/styles";

export const nanaColors = {
  orange: "#f57c00",
  orangeSoft: "#fff1dc",
  green: "#2e7d32",
  greenSoft: "#e8f5e9",
  cream: "#fffaf3",
  ink: "#243228",
  muted: "#6d746e",
  line: "#f0e3d1",
};

export const nanaTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: nanaColors.orange,
      light: "#ffad42",
      dark: "#bb4d00",
      contrastText: "#ffffff",
    },
    secondary: {
      main: nanaColors.green,
      light: "#60ad5e",
      dark: "#005005",
      contrastText: "#ffffff",
    },
    background: {
      default: nanaColors.cream,
      paper: "#ffffff",
    },
    text: {
      primary: nanaColors.ink,
      secondary: nanaColors.muted,
    },
  },
  shape: {
    borderRadius: 24,
  },
  typography: {
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    h1: { fontWeight: 800, letterSpacing: "-0.04em" },
    h2: { fontWeight: 800, letterSpacing: "-0.03em" },
    h3: { fontWeight: 800, letterSpacing: "-0.03em" },
    button: { fontWeight: 800, textTransform: "none" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          boxShadow: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 28,
          border: `1px solid ${nanaColors.line}`,
          boxShadow: "0 18px 50px rgba(74, 49, 16, 0.08)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
        },
      },
    },
  },
});
