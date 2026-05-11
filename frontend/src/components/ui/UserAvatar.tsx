import type { CSSProperties } from "react";

type UserAvatarProps = {
  fullName?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  className?: string;
};

export function UserAvatar({ fullName, avatarColor, avatarUrl, className }: UserAvatarProps) {
  const style = { background: avatarColor || "#2563eb" } as CSSProperties;

  if (avatarUrl) {
    return <img className={className ? `avatar avatar-image ${className}` : "avatar avatar-image"} src={avatarUrl} alt={fullName || "User avatar"} />;
  }

  return <div className={className ? `avatar ${className}` : "avatar"} style={style} aria-label={fullName || "User avatar"} />;
}
