import sanitizeHtml from "sanitize-html";

export const sanitizePlainText = (value: string) => {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
};
