import { z } from "zod";
import { plannerSchema, plannerDateSchema } from "./planner-model";
import { nutritionProfileSchema } from "./nutrition-profile";

export const answersSchema = z.object({
  name: z.string().trim().min(1).max(24),
  planningStyle: z.enum(["spontaneous","planned"]).optional(),
  age: z.enum(["18-29", "30-39", "40-49", "50-64", "65+"]),
  goal: z.enum(["balance", "sleep", "energy", "fitness", "food", "stress"]),
  work: z.enum(["regular", "flexible", "shift", "student", "care"]),
  bed: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  wake: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sleepHours: z.coerce.number().min(2).max(12),
  sleepQuality: z.coerce.number().int().min(1).max(5),
  weekendShift: z.coerce.number().min(0).max(6),
  scheduleShiftHours: z.number().min(0).max(6).nullable().optional(),
  sleepSymptoms: z.array(z.enum(["falling", "waking", "snoring", "sleepy"])).max(4),
  meals: z.coerce.number().int().min(1).max(4),
  skip: z.enum(["none", "breakfast", "lunch", "dinner"]),
  regularMeals: z.boolean(),
  vegetables: z.coerce.number().int().min(0).max(7),
  protein: z.coerce.number().int().min(0).max(7),
  fish: z.coerce.number().int().min(0).max(7),
  dairy: z.coerce.number().int().min(0).max(7),
  fruit: z.coerce.number().int().min(0).max(7),
  takeaway: z.coerce.number().int().min(0).max(14),
  lateMeals: z.coerce.number().int().min(0).max(7),
  water: z.coerce.number().int().min(0).max(15),
  caffeine: z.coerce.number().int().min(0).max(10),
  caffeineTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  alcohol: z.coerce.number().int().min(0).max(7),
  smoking: z.enum(["no", "former", "yes"]),
  diet: z.enum(["mixed", "vegetarian", "vegan", "restricted"]),
  exerciseDays: z.coerce.number().int().min(0).max(7),
  exerciseMinutes: z.coerce.number().int().min(0).max(180),
  exerciseIntensity: z.enum(["light", "moderate", "vigorous"]),
  moderateWeeklyMinutes: z.number().int().min(0).max(2520).nullable().optional(),
  vigorousWeeklyMinutes: z.number().int().min(0).max(2520).nullable().optional(),
  strengthAllGroups: z.enum(["yes","no","unknown"]).optional(),
  fruitVegGrams: z.number().min(0).max(2000).nullable().optional(),
  wholegrainDays: z.number().int().min(0).max(7).nullable().optional(),
  legumeDays: z.number().int().min(0).max(7).nullable().optional(),
  processedMeatDays: z.number().int().min(0).max(7).nullable().optional(),
  strengthDays: z.coerce.number().int().min(0).max(7),
  sitting: z.coerce.number().min(0).max(18),
  movementLimit: z.boolean(),
  stress: z.coerce.number().int().min(1).max(5),
  energy: z.coerce.number().int().min(1).max(5),
  available: z.coerce.number().int().min(5).max(60),
  barrier: z.enum(["time", "tired", "forget", "hard", "environment"]),
  supplementOptIn: z.boolean(), conditions: z.boolean(), medicines: z.boolean(), pregnancy: z.boolean(),
  surgery: z.boolean(), allergy: z.boolean(), uncertainSafety: z.boolean(),
  safetyDetails: z.string().max(500), currentSupplements: z.string().max(500), confirmedDeficiency: z.string().max(300), safetyReviewed:z.boolean().optional(),
});
export type Answers = z.infer<typeof answersSchema>;
export const defaultAnswers: Answers = {
  name: "", age: "18-29", goal: "balance", work: "regular", bed: "23:30", wake: "07:00",
  sleepHours: 7, sleepQuality: 3, weekendShift: 1, sleepSymptoms: [], meals: 3, skip: "none", regularMeals: true,
  vegetables: 4, protein: 5, fish: 2, dairy: 3, fruit: 3, takeaway: 3, lateMeals: 1,
  water: 5, caffeine: 1, caffeineTime: "14:00", alcohol: 0, smoking: "no", diet: "mixed",
  exerciseDays: 2, exerciseMinutes: 20, exerciseIntensity: "moderate", strengthDays: 0, sitting: 8, movementLimit: false,
  stress: 3, energy: 3, available: 15, barrier: "time", supplementOptIn: true,
  conditions: false, medicines: false, pregnancy: false, surgery: false, allergy: false, uncertainSafety: false,
  safetyDetails: "", currentSupplements: "", confirmedDeficiency: "",
};
export const checkinSchema = z.object({
  sleep: z.coerce.number().min(0).max(14), energy: z.coerce.number().int().min(1).max(5),
  stress: z.coerce.number().int().min(1).max(5), minutes: z.coerce.number().int().min(5).max(60),
  unwell: z.boolean(), place: z.enum(["home", "office", "outside", "gym"]), busy: z.boolean(),
  exerciseType:z.enum(["unknown","none","light","strength","cardio"]).optional(),
  exerciseMinutes:z.number().int().min(0).max(180).optional(),
  studyMinutes:z.number().int().min(0).max(720).optional(),
  sleepQuality:z.enum(["good","okay","poor","unknown"]).optional(),
  sleepOpportunity:z.number().min(0).max(14).nullable().optional(),
});
export type Checkin = z.infer<typeof checkinSchema>;
export const eventSchema = z.object({ id: z.string().max(80), title: z.string().trim().min(1).max(60), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), category:z.string().max(30).optional(), description:z.string().max(300).optional(), breakStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), breakEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional() });
export const scheduleSchema = z.object({
  wake: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), bed: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  breakfast: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), lunch: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), dinner: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  commute: z.coerce.number().int().min(0).max(180), preparation: z.coerce.number().int().min(0).max(120),
  exercise: z.enum(["walk", "stretch", "strength"]), peak: z.enum(["morning", "afternoon", "evening"]),
  cooking: z.boolean(), buffer: z.coerce.number().int().min(5).max(30), events: z.array(eventSchema).max(60),
});
export type Schedule = z.infer<typeof scheduleSchema>;
export const defaultSchedule: Schedule = { wake: "07:00", bed: "23:00", breakfast: "07:40", lunch: "12:30", dinner: "19:00", commute: 30, preparation: 40, exercise: "walk", peak: "morning", cooking: true, buffer: 10, events: [] };
export const inbodySchema = z.object({
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
    const date = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === v && v <= localDate();
  }, "측정일은 유효한 오늘 또는 이전 날짜여야 합니다."), height: z.coerce.number().min(100).max(230),
  weight: z.coerce.number().min(25).max(300), muscle: z.coerce.number().min(5).max(100),
  fat: z.coerce.number().min(2).max(65), bmr: z.coerce.number().min(500).max(4000).optional(),
}).superRefine((v, ctx) => { if (v.muscle >= v.weight) ctx.addIssue({ code: "custom", path: ["muscle"], message: "골격근량은 체중보다 작아야 합니다." }); });
export type Inbody = z.infer<typeof inbodySchema>;
export const routineGuidanceSchema = z.object({
  kind: z.enum(["food", "reading", "music"]),
  heading: z.string().max(80), intro: z.string().max(300),
  items: z.array(z.object({name:z.string().max(100),note:z.string().max(300)})).max(8),
  caution: z.string().max(500),
  sources: z.array(z.object({label:z.string().max(100),url:z.string().url().regex(/^https:\/\//).max(500)})).max(4),
});
export type RoutineGuidance = z.infer<typeof routineGuidanceSchema>;
export const routineSchema = z.object({
  id: z.string().max(100), category: z.enum(["sleep", "food", "move", "mind"]), title: z.string().max(150),
  detail: z.string().max(300), reason: z.string().max(300), minutes: z.number().min(0).max(120),
  when: z.string().max(80), fallback: z.string().max(150),
  source: z.enum(["auto", "catalog", "custom"]).optional(),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  held: z.boolean().optional(),
  guidance: routineGuidanceSchema.optional(),
});
export type Routine = z.infer<typeof routineSchema>;
export const timelineSchema = z.object({id: z.string().max(150), title: z.string().max(150), start: z.string().max(5), end: z.string().max(5), kind: z.enum(["fixed", "routine", "meal", "rest"]), detail: z.string().max(300), routineId: z.string().max(100).optional()});
export type TimelineItem = z.infer<typeof timelineSchema>;
export const daySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), routines: z.array(routineSchema).max(20).refine(rows => new Set(rows.map(r => r.id)).size === rows.length, "같은 루틴을 중복해서 담을 수 없어요."),
  statuses: z.record(z.enum(["done", "partial", "skipped"])), notes: z.record(z.string().max(150)).default({}),
  checkin: checkinSchema, generation: z.number().int().min(0).max(1000000).optional(), mode: z.enum(["core", "full"]), timeline: z.array(timelineSchema).max(150), warnings: z.array(z.string().max(300)).max(100),
  planningContext:z.object({date:plannerDateSchema,scheduledMinutes:z.number().min(0).max(1440),mental:z.number().min(1).max(5),physical:z.number().min(1).max(5),effectiveMinutes:z.number().min(0).max(60),importedIds:z.array(z.string().max(80)).max(40)}).optional(),
});
export type Day = z.infer<typeof daySchema>;
export const stateSchema = z.object({
  version: z.literal(1), consentAt: z.string().datetime(), consentVersion: z.literal("2026-10-v1"),
  answers: answersSchema, schedule: scheduleSchema, inbody: z.array(inbodySchema).max(30), days: z.array(daySchema).max(90), planner:plannerSchema.optional(),
  nutrition:nutritionProfileSchema.optional(),
});
export type AppState = z.infer<typeof stateSchema>;
export type AnalysisMetric = {label:string;value:string;reference:string;status:"met"|"below"|"unknown"|"self"|"individual"};
export type Analysis = { category: "sleep" | "food" | "move" | "mind"; label: string; status:string; headline: string; observation: string; metrics:AnalysisMetric[]; limitation:string; sources:import("./evidence").EvidenceId[]; };
export const categoryLabels = { sleep: "수면·회복", food: "식사·영양", move: "움직임", mind: "스트레스" };
export const goalLabels = { balance: "균형 있는 일상", sleep: "숙면", energy: "활력 회복", fitness: "운동 습관", food: "식사 균형", stress: "스트레스 관리" };
export function localDate(date = new Date()): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export function toMinutes(time: string) { const [h, m] = time.split(":").map(Number); return h * 60 + m; }
export function toTime(m: number) { return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
export function initialCheckin(a: Answers): Checkin { return { sleep: a.sleepHours, energy: a.energy, stress: a.stress, minutes: a.available, unwell: false, place: "home", busy: false }; }
