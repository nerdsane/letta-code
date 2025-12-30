/**
 * Deep Sci-Fi Color System
 *
 * This file defines all colors used in the application.
 * No colors should be hardcoded in components - all should reference this file.
 */

// Brand colors (dark mode) - Cyberpunk Neon Theme (Cool Colors Only)
export const brandColors = {
  orange: "#FF5533", // dark orange
  blue: "#0707AC", // dark blue
  // text colors
  primaryAccent: "#00F0FF", // neon teal/cyan - cyberpunk primary
  primaryAccentLight: "#B026FF", // neon purple - cyberpunk accent
  textMain: "#DEE1E4", // white
  textSecondary: "#A5A8AB", // light grey
  textDisabled: "#46484A", // dark grey
  // status colors
  statusSuccess: "#00F0FF", // neon teal (cool, not warm green)
  statusWarning: "#B026FF", // neon purple
  statusError: "#FF00FF", // neon magenta
} as const;

// Brand colors (light mode) - Cyberpunk Neon Theme (Cool Colors Only)
export const brandColorsLight = {
  orange: "#FF5533", // dark orange
  blue: "#0707AC", // dark blue
  // text colors
  primaryAccent: "#00B8CC", // darker teal for light mode
  primaryAccentLight: "#8B1ACF", // darker purple for light mode
  textMain: "#202020", // black
  textSecondary: "#797B7D", // grey
  textDisabled: "#A5A8AB", // light grey
  // status colors
  statusSuccess: "#00B8CC", // darker teal
  statusWarning: "#8B1ACF", // darker purple
  statusError: "#CC00CC", // darker magenta
} as const;

// Semantic color system
export const colors = {
  // Welcome screen
  welcome: {
    border: brandColors.primaryAccent,
    accent: brandColors.primaryAccent,
  },

  // Selector boxes (model, agent, generic select)
  selector: {
    border: brandColors.primaryAccentLight,
    title: brandColors.primaryAccentLight,
    itemHighlighted: brandColors.primaryAccent,
    itemCurrent: brandColors.statusSuccess, // for "(current)" label
  },

  // Command autocomplete and command messages
  command: {
    selected: brandColors.primaryAccent,
    inactive: brandColors.textDisabled, // uses dimColor prop
    border: brandColors.textDisabled,
    running: brandColors.statusWarning,
    error: brandColors.statusError,
  },

  // Approval/HITL screens
  approval: {
    border: brandColors.primaryAccentLight,
    header: brandColors.primaryAccent,
  },

  // Code and markdown elements (use terminal theme colors)
  code: {
    inline: "green",
  },

  link: {
    text: "cyan",
    url: brandColors.primaryAccent,
  },

  heading: {
    primary: "cyan",
    secondary: brandColors.primaryAccent,
  },

  // Status indicators
  status: {
    error: brandColors.statusError,
    success: brandColors.statusSuccess,
    interrupt: brandColors.statusError,
    processing: brandColors.primaryAccent, // base text color
    processingShimmer: brandColors.primaryAccentLight, // shimmer highlight
  },

  // Tool calls
  tool: {
    pending: brandColors.textSecondary, // blinking dot (ready/waiting for approval)
    completed: brandColors.statusSuccess, // solid green dot (finished successfully)
    streaming: brandColors.textDisabled, // solid gray dot (streaming/in progress)
    running: brandColors.statusWarning, // blinking yellow dot (executing)
    error: brandColors.statusError, // solid red dot (failed)
    memoryName: brandColors.primaryAccent, // memory tool name highlight (matches thinking spinner)
  },

  // Input box
  input: {
    border: brandColors.textDisabled,
    prompt: brandColors.textMain,
  },

  // Bash mode
  bash: {
    prompt: brandColors.statusError, // Red ! prompt
    border: brandColors.statusError, // Red horizontal bars
    dot: brandColors.statusError, // Red dot in output
  },

  // Todo list
  todo: {
    completed: brandColors.blue,
    inProgress: brandColors.primaryAccent,
  },

  // Subagent display
  subagent: {
    header: brandColors.primaryAccent,
    running: brandColors.statusWarning,
    completed: brandColors.statusSuccess,
    error: brandColors.statusError,
    treeChar: brandColors.textDisabled,
    hint: brandColors.textDisabled,
  },

  // Info/modal views
  info: {
    border: brandColors.primaryAccent,
    prompt: brandColors.primaryAccent,
  },

  // Diff rendering
  diff: {
    addedLineBg: "#1a4d1a",
    addedWordBg: "#2d7a2d",
    removedLineBg: "#4d1a1a",
    removedWordBg: "#7a2d2d",
    contextLineBg: undefined,
    textOnDark: "white",
    textOnHighlight: "white",
    symbolAdd: "green",
    symbolRemove: "red",
    symbolContext: undefined,
  },

  // Error display
  error: {
    border: "red",
    text: "red",
  },

  // Generic text colors (used with dimColor prop or general text)
  text: {
    normal: "white",
    dim: "gray",
    bold: "white",
  },

  // Footer bar
  footer: {
    agentName: brandColors.primaryAccent,
  },
} as const;
