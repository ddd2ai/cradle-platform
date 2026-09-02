/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  readStoredPreferences,
  translate,
  writeStoredPreferences,
} from "./uiPreferences";

const DEFAULT_CONTEXT = {
  locale: "en",
  theme: "dark",
  setLocale: () => {},
  setTheme: () => {},
  t: (key, values) => translate("en", key, values),
};

const UiPreferencesContext = createContext(DEFAULT_CONTEXT);

export function UiPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(() =>
    readStoredPreferences(typeof window === "undefined" ? null : window.localStorage)
  );

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.locale;
    document.documentElement.style.colorScheme = preferences.theme === "glass" ? "dark" : preferences.theme;
    writeStoredPreferences(window.localStorage, preferences);
  }, [preferences]);

  const value = useMemo(() => ({
    ...preferences,
    setLocale: (locale) => setPreferences((current) => ({ ...current, locale })),
    setTheme: (theme) => setPreferences((current) => ({ ...current, theme })),
    t: (key, values) => translate(preferences.locale, key, values),
  }), [preferences]);

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  return useContext(UiPreferencesContext);
}
