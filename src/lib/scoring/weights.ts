import { defaultBuyBox } from "@/types/site-brief";
import type { BuyBox, ScoreWeights } from "@/types/site-brief";

export const defaultScoreWeights: ScoreWeights = defaultBuyBox.weights;

export function mergeBuyBox(input?: Partial<BuyBox> & { weights?: Partial<ScoreWeights> }): BuyBox {
  return {
    ...defaultBuyBox,
    ...input,
    weights: {
      ...defaultBuyBox.weights,
      ...input?.weights,
    },
  };
}
