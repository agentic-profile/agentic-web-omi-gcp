import React from "react";
import { bestPhotoSize, userImageUri } from "../utils/image";
const AnonymousHead = "/images/anonymous.png";

type MediaLike = {
  images?: Record<string, string> | string[];
};

type UserLike = {
  media?: MediaLike;
  disabled?: boolean;
  name?: string;
};

type Props = {
  user?: UserLike | null;
  size?: number;
  className?: string;
  alt?: string;
  children?: React.ReactNode;
};

export default function UserImage({ user, size, className, alt, children }: Props) {
  const width = size ?? 40;
  const height = size ?? 40;
  const isDisabled = !!user?.disabled;

  const imageStyle: React.CSSProperties = {
    borderRadius: Math.min(width, height) / 2,
    width,
    height,
    ...(isDisabled ? { borderWidth: 4, borderColor: "red", borderStyle: "solid" } : {}),
  };

  const imageSize = bestPhotoSize(user?.media?.images, { width, height });
  const source = user && imageSize ? userImageUri(user, imageSize) : AnonymousHead;

  return (
    <div className={className}>
      <img
        src={source}
        alt={alt ?? user?.name ?? "User"}
        style={imageStyle}
        referrerPolicy="no-referrer"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (img.src !== AnonymousHead) {
            img.onerror = null;
            img.src = AnonymousHead;
          }
        }}
      />
      {children}
    </div>
  );
}