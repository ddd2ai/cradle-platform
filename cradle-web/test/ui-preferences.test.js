import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_UI_PREFERENCES,
  normalizePreferences,
  readStoredPreferences,
  translate,
  UI_PREFERENCES_STORAGE_KEY,
  writeStoredPreferences,
} from "../src/i18n/uiPreferences.js";
import { SUPPORTED_LOCALES } from "../src/i18n/translations.js";

function createStorage(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set(UI_PREFERENCES_STORAGE_KEY, initialValue);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("UI preferences default to English and dark theme", () => {
  assert.deepEqual(readStoredPreferences(createStorage()), DEFAULT_UI_PREFERENCES);
  assert.deepEqual(normalizePreferences({ locale: "unknown", theme: "neon" }), DEFAULT_UI_PREFERENCES);
  assert.deepEqual(normalizePreferences({ locale: "en", theme: "light" }), DEFAULT_UI_PREFERENCES);
});

test("UI preferences persist a supported language and Glass theme", () => {
  assert.deepEqual(SUPPORTED_LOCALES, ["en", "zh-TW", "ja", "ko", "th"]);
  for (const locale of SUPPORTED_LOCALES) {
    const storage = createStorage();
    writeStoredPreferences(storage, { locale, theme: "glass" });
    assert.deepEqual(readStoredPreferences(storage), { locale, theme: "glass" });
  }
});

test("primary Incubator controls have concrete text in all five languages", () => {
  assert.deepEqual(
    SUPPORTED_LOCALES.map((locale) => ({
      cultivate: translate(locale, "incubator.cultivate"),
      feed: translate(locale, "incubator.feedPlaceholder"),
      reset: translate(locale, "common.reset"),
      server: translate(locale, "server.connected"),
    })),
    [
      {
        cultivate: "Cultivate",
        feed: "Feed Cradle. It will find the right Cell...",
        reset: "Reset",
        server: "Server connected",
      },
      {
        cultivate: "培養",
        feed: "餵養 Cradle，系統會找到合適的細胞…",
        reset: "重設",
        server: "伺服器已連線",
      },
      {
        cultivate: "育成する",
        feed: "Cradle に与えると、適切なセルを見つけます…",
        reset: "リセット",
        server: "サーバー接続済み",
      },
      {
        cultivate: "육성",
        feed: "Cradle에 자료를 주세요. 알맞은 세포를 찾습니다...",
        reset: "초기화",
        server: "서버 연결됨",
      },
      {
        cultivate: "เพาะเลี้ยง",
        feed: "ป้อนข้อมูลให้ Cradle แล้วระบบจะค้นหาเซลล์ที่เหมาะสม...",
        reset: "รีเซ็ต",
        server: "เชื่อมต่อเซิร์ฟเวอร์แล้ว",
      },
    ],
  );
});

test("translation interpolation keeps runtime data unchanged", () => {
  assert.equal(
    translate("zh-TW", "incubator.aiUpdated", { provider: "codex", model: "gpt-5.6" }),
    "AI 設定已更新：codex / gpt-5.6",
  );
});
