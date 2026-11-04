import type { CSSProperties } from "react";
import { plannerColors,type Planner,type PlannerBlock } from "./planner-model";

export type CategoryColors=NonNullable<Planner["categoryColors"]>;
export const plannerPalette={4:"빨강",20:"코랄",35:"주황",48:"노랑",95:"연두",145:"초록",164:"민트",187:"청록",215:"파랑",245:"남색",270:"보라",326:"분홍"} as const;
export function plannerHue(category:PlannerBlock["category"],colors?:CategoryColors){return colors?.[category]??plannerColors[category];}
export function plannerSwatch(category:PlannerBlock["category"],shade=1,colors?:CategoryColors):CSSProperties{
  return {"--block-hue":plannerHue(category,colors),"--block-sat":`${35+shade*15}%`,"--block-light":`${98-shade*4}%`} as CSSProperties;
}
