export const MEDIA_CATEGORIES = [
  { id: "pickleball", label: "Pickleball" },
  { id: "exercises", label: "Exercises" },
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number]["id"];

export function categoryLabel(category: MediaCategory): string {
  const match = MEDIA_CATEGORIES.find((item) => item.id === category);
  return match?.label ?? "Pickleball";
}
