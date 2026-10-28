import { plannerBlockSchema, plannerSchema, type Planner, type PlannerBlock } from "./planner-model";
import { toMinutes, toTime } from "./model";
import { validatePlanner, weekday } from "./planner";

export type PlacementRange = { date: string; start: string; end: string };

/** Build independent weekday schedules together, so a failed range cannot partially save. */
export function placeBlockRanges(planner: Planner, block: PlannerBlock, ranges: PlacementRange[], groupId: string, keep: boolean, newId: () => string): Planner {
  if (!ranges.length) throw new Error("시간대를 하나 이상 선택해주세요.");
  if (ranges.length > 30) throw new Error("한 번에 최대 30개 시간대를 선택할 수 있어요.");
  const blocks = ranges.map(range => {
    const shift = (time: string | undefined) => time ? toTime(toMinutes(range.start) + (toMinutes(time) - toMinutes(block.start) + 1440) % 1440) : undefined;
    const parsed = plannerBlockSchema.safeParse({ ...block, ...range, id: newId(), groupId,
      weekdays: block.kind === "fixed" ? [weekday(range.date)] : [], excludedDates: [],
      breakStart: shift(block.breakStart), breakEnd: shift(block.breakEnd) });
    if (!parsed.success) throw new Error(`${range.date}: ${parsed.error.issues[0].message}`);
    return parsed.data;
  });
  const { id, kind, date, weekdays, until, excludedDates, ...fields } = blocks[0];
  const next = plannerSchema.safeParse({ ...planner, blocks: [...planner.blocks, ...blocks],
    templates: keep ? [...planner.templates.filter(t => (t.groupId ?? t.id) !== groupId), { ...fields, id: newId() }] : planner.templates });
  if (!next.success) throw new Error(next.error.issues[0].message);
  const conflicts = validatePlanner(next.data);
  if (conflicts.length) throw new Error(conflicts.join("\n"));
  return next.data;
}
