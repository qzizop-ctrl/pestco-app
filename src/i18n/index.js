// ============================================================================
// Public i18n entry point. Re-exports STRINGS = { ar, en } exactly like the
// old single-file i18n.js did, so every other import in the app is unchanged
// (`import { STRINGS } from "./i18n"` or "../i18n" still works).
// ============================================================================
import { AR } from "./ar";
import { EN } from "./en";

export const STRINGS = { ar: AR, en: EN };
