import {
  BatteryCharging, Box, Cog, Drill, Fan, Flame, Hammer, HardHat, Lamp, Nut, Ruler, Sprout, Wrench,
  type LucideIcon,
} from "lucide-react";
import type { IconKey } from "@/lib/types";

export const ICONS: Record<IconKey, LucideIcon> = {
  drill: Drill,
  saw: Cog,
  hammer: Hammer,
  wrench: Wrench,
  battery: BatteryCharging, // plain Battery reads as an empty rectangle at large sizes
  sprout: Sprout,
  box: Box,
  flame: Flame,
  hardhat: HardHat,
  lamp: Lamp,
  nut: Nut,
  ruler: Ruler,
  fan: Fan,
};

/**
 * Generated product/banner artwork. Used when a product has no `image` URL,
 * so the store looks complete before you upload real photography.
 */
export default function ToolArt({
  icon,
  tint,
  image,
  alt = "",
  className = "",
  variant = "soft",
}: {
  icon: IconKey;
  tint: string;
  image?: string;
  alt?: string;
  className?: string;
  variant?: "soft" | "bold";
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={alt} className={`h-full w-full object-contain ${className}`} />;
  }
  const Icon = ICONS[icon] ?? Wrench;
  const bold = variant === "bold";
  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{
        background: bold
          ? `radial-gradient(circle at 70% 40%, ${tint}ee, ${tint}99 45%, #0b1b22 100%)`
          : `radial-gradient(circle at 50% 45%, ${tint}22, #f8fafc 70%)`,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          width: "70%",
          aspectRatio: "1",
          background: bold ? "#ffffff14" : `${tint}14`,
        }}
      />
      <Icon
        strokeWidth={1.25}
        className="relative h-1/2 w-1/2 drop-shadow-lg"
        style={{ color: bold ? "#ffffff" : tint }}
      />
    </div>
  );
}
