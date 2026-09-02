import { SUPPORTED_LOCALES, TRANSLATIONS } from "./translations.js";

export const DEFAULT_UI_PREFERENCES = Object.freeze({ locale: "en", theme: "dark" });
export const UI_PREFERENCES_STORAGE_KEY = "cradle.ui-preferences.v1";

export function normalizePreferences(value) {
  return {
    locale: SUPPORTED_LOCALES.includes(value?.locale) ? value.locale : DEFAULT_UI_PREFERENCES.locale,
    theme: ["dark", "glass"].includes(value?.theme) ? value.theme : DEFAULT_UI_PREFERENCES.theme,
  };
}

export function readStoredPreferences(storage) {
  if (!storage) return { ...DEFAULT_UI_PREFERENCES };
  try {
    return normalizePreferences(JSON.parse(storage.getItem(UI_PREFERENCES_STORAGE_KEY)));
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

export function writeStoredPreferences(storage, preferences) {
  storage?.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)));
}

export function translate(locale, key, values = {}) {
  const template = TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
