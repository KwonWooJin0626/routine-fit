import { z } from "zod";
import { executionInputSchema,petSourceSchema } from "./pet-model";

/** Human facts are independent of a companion's lifecycle. Never infer times from checks. */
export const activityJournalSchema=z.object({
  records:z.array(executionInputSchema.omit({source:true,linkTo:true}).extend({
    id:z.string().min(1).max(100),sources:z.array(petSourceSchema).max(100),cancelled:z.boolean(),
    cancelledStatus:z.literal("skipped").optional(),feeling:z.enum(["fresh","same","tired"]),updatedAt:z.string().datetime(),
  })).max(2000).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length,"실제 활동 ID가 중복됐어요."),
  receipts:z.array(z.object({key:z.string().uuid(),hash:z.string().max(12000)})).max(100),
});
export type ActivityExecution=z.infer<typeof activityJournalSchema>["records"][number];
export type ActivityJournal=z.infer<typeof activityJournalSchema>;
