import { z } from "zod";
import { plannerDateSchema } from "./planner-model";

const optionalScore=z.number().min(1).max(5).nullable();
export const morningRecordSchema=z.object({
  date:plannerDateSchema,recordedAt:z.string().datetime(),
  energy:z.number().int().min(1).max(5),unwell:z.boolean(),
  sleepHours:z.number().min(0).max(24).nullable(),
  sleepSource:z.enum(["reported","recorded","unknown"]),
  previousMental:optionalScore,previousPhysical:optionalScore,
  previousMentalMinutes:z.number().min(0).max(1440),previousPhysicalMinutes:z.number().min(0).max(1440),
  previousActivityMinutes:z.number().min(0).max(1440),
  previousExercise:z.number().min(0).max(1440),
  previousFocus:z.number().min(0).max(1440),
  previousRest:z.number().min(0).max(1440),
  petStamina:z.number().min(0).max(150).nullable(),
  petStress:z.number().min(0).max(100).nullable(),
  snapshotAt:z.string().datetime().optional(),
  snapshotBasis:z.enum(["sleep","activity","midnight"]).optional(),
  windowStart:z.string().datetime().optional(),
  highMentalMinutes:z.number().min(0).max(1440).optional(),
  highPhysicalMinutes:z.number().min(0).max(1440).optional(),
  lateMinutes:z.number().min(0).max(1440).optional(),
});
export type MorningRecord=z.infer<typeof morningRecordSchema>;
export const morningFeedbackSchema=z.object({date:plannerDateSchema,id:z.string().max(100),kind:z.enum(["rest","reading","video","walk","winddown","focus","exercise","move"]),action:z.enum(["added","applied","dismissed"]),at:z.string().datetime(),routineId:z.string().max(100).optional()});
export type MorningFeedback=z.infer<typeof morningFeedbackSchema>;
