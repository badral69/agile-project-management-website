import { Languages } from "lucide-react";
import { useI18n, type SupportedLocale } from "../../features/i18n/I18nContext";

type LanguageSwitcherProps = {
  compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={compact ? "language-switcher language-switcher-compact" : "language-switcher"}>
      {compact ? null : <Languages size={16} />}
      <select value={locale} aria-label={t("common.language")} onChange={(event) => setLocale(event.target.value as SupportedLocale)}>
        <option value="en">{compact ? "EN" : t("common.english")}</option>
        <option value="mn">{compact ? "MN" : t("common.mongolian")}</option>
        <option value="ja">{compact ? "JP" : t("common.japanese")}</option>
      </select>
    </label>
  );
}
