import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function base64UrlEncode(payload: any): string {
  const jsonStr = JSON.stringify(payload);
  // Base64 encode with UTF-8 support
  const base64 = btoa(jsonStr);
  // Convert to base64url (replace + with -, / with _, and remove padding =)
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return base64url;
}
