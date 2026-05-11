import { format } from "date-fns";

export const formatDate = (value?: string | null) => {
  if (!value) {
    return "Not set";
  }

  return format(new Date(value), "dd MMM yyyy");
};

export const formatRelativeRole = (role: string) => {
  return role.charAt(0) + role.slice(1).toLowerCase();
};

export const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");
