const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MemberAvatar({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "size-7 text-xs" : "size-9 text-sm";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ${sizeClass} ${colorForId(id)}`}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
