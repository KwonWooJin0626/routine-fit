import { getSessionUser } from "@/lib/auth";
import { z } from "zod";
import { answersSchema, checkinSchema, daySchema, inbodySchema, scheduleSchema, localDate } from "@/lib/model";
import { analyze, buildTimeline, supplementGuides, validateSchedule } from "@/lib/engine";

import { plannerSchema } from "@/lib/planner-model";
import { buildPlannedDay,scheduleForDate } from "@/lib/planner";

export async function POST(request: Request) {
  if (!await getSessionUser()) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "잘못된 요청입니다." }, { status: 403 });
  const text = await request.text();
  if (text.length > 500_000) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  try {
    const input = z.object({ answers: answersSchema, checkin: checkinSchema, mode: z.enum(["core", "full"]), schedule: scheduleSchema, history: z.array(daySchema).max(90), inbody: inbodySchema.optional(), refresh: z.boolean().default(true),planner:plannerSchema.optional() }).parse(JSON.parse(text));
    // A new full-day allocation must resolve essential slots. A check-in must
    // still save recovery restrictions even if an older plan has conflicts.
    const schedule=scheduleForDate(input.schedule,input.planner,localDate());
    const errors = input.mode === "full" && !input.refresh ? [...validateSchedule(schedule),...buildTimeline([],schedule).warnings] : [];
    if (errors.length) return Response.json({ error: errors.join("\n") }, { status: 400 });
    return Response.json({ day: buildPlannedDay(input.answers, input.checkin, input.mode, input.schedule, input.history, input.inbody, localDate(), input.refresh,input.planner), analysis: analyze(input.answers), supplements: supplementGuides(input.answers) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "문진과 일정 입력값을 확인해주세요." }, { status: 400 }); }
}
