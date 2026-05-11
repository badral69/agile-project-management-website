import { Link } from "react-router-dom";
import { useI18n } from "../features/i18n/I18nContext";

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section className="page centered-page">
      <div className="panel centered-panel">
        <span className="eyebrow">404</span>
        <h1>{t("error.404.title")}</h1>
        <p>{t("error.404.desc")}</p>
        <Link className="primary-button" to="/">
          {t("error.404.back")}
        </Link>
      </div>
    </section>
  );
}
