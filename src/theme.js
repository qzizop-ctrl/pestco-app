// ============================================================================
// Theme: color tokens, CSS-variable maps, and the id -> color lookup helpers
// for sectors/stages/offer statuses/activity types. Pure data + pure
// functions, no React/Firebase — split out of the old constants.js.
// ============================================================================

export const PRIMARY = "#0F2E5E";

export const PRIMARY_MID = "#2A5FA8";

export const SURFACE = "var(--surface)";

export const SURFACE_SUBTLE = "var(--surface-subtle)";

export const TEXT = "var(--text)";

export const MUTED = "var(--muted)";

export const DANGER = "#B3401F";

export const SUCCESS = "#2F9E58";

export const GOLD = "#C08A3E";

export const GOLD_SOFT = "#F3E6D0";

export const LINE = "var(--line)";

export const THEME_VARS = {
  light: { "--bg": "#E4E0D5", "--surface": "#FFFFFF", "--surface-subtle": "#F8F6F0", "--text": "#1B241F", "--muted": "#6B7168", "--line": "#E7E2D6" },
  dark: { "--bg": "#0F1720", "--surface": "#182430", "--surface-subtle": "#1F2E3B", "--text": "#ECEAE2", "--muted": "#93A0AC", "--line": "#2C3B48" },
};

export const STATUS_COLORS = {
  overdue: "#C4443A",
  today: "#DB9A2C",
  upcoming: "#2E6B8F",
  none: "#9AA39B",
};

export const ACTIVITY_COLORS = {
  created: "#0F6E56",
  stage: "#534AB7",
  call: "#2E6B8F",
  note: "#B9832A",
  offer: "#C08A3E",
  visit: "#2F9E58",
};

const SECTOR_COLORS = {
  construction: "#8C5A2C",
  education: "#2C6E8C",
  consultants: "#3D8C6C",
  private: "#6B4C8C",
};

export const sectorColor = (id) => SECTOR_COLORS[id] || SECTOR_COLORS.private;

const STAGE_COLORS = {
  survey: "#6B7168",
  quote: "#B9832A",
  install: "#0F6E56",
  maintenance: "#534AB7",
};

export const stageColor = (id) => STAGE_COLORS[id] || STAGE_COLORS.survey;

const OFFER_STATUS_COLORS = {
  pending: "#DB9A2C",
  purchased: "#2F9E58",
  rejected: "#C4443A",
  installed: "#2E6B8F",
};

export const offerStatusColor = (id) => OFFER_STATUS_COLORS[id] || OFFER_STATUS_COLORS.pending;
