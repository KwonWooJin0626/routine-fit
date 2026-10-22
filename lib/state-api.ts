import { z } from "zod";
import { localDate, stateSchema } from "./model";
import { validatePlanner } from "./planner";

export type StateRow = { payload: string; revision: number };
export type StateRepository = {
  get: (userId: string) => Promise<StateRow | null>;
  save: (userId: string, payload: string, expectedRevision: number) => Promise<number | null>;
  remove: (userId: string) => Promise<void>;
};
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: {
  "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
} });
const sameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;
const inputSchema = z.object({ state: stateSchema, revision: z.number().int().min(0) });

// Production uses only verified Clerk identity and Postgres storage.
// Dependency injection enables unit tests without a runtime auth bypass.
export function createStateHandlers(identity: () => Promise<string | null>, repository: StateRepository) {
  return {
    async GET() {
      const userId = await identity();
      if (!userId) return response({ error: "로그인이 필요합니다." }, 401);
      try {
        const row = await repository.get(userId);
        if (!row) return response({ state: null, revision: 0 });
        const parsed = stateSchema.safeParse(JSON.parse(row.payload));
        if (!parsed.success) return response({ error: "저장된 데이터 형식을 확인해야 합니다. 관리자에게 문의해주세요." }, 500);
        return response({ state: parsed.data, revision: row.revision });
      } catch { return response({ error: "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요." }, 503); }
    },
    async PUT(request: Request) {
      const userId = await identity();
      if (!userId) return response({ error: "로그인이 필요합니다." }, 401);
      if (!sameOrigin(request)) return response({ error: "같은 사이트에서 요청해주세요." }, 403);
      let input: z.infer<typeof inputSchema>;
      try {
        const raw = await request.text();
        if (raw.length > 500_000) return response({ error: "저장 데이터가 너무 큽니다." }, 413);
        input = inputSchema.parse(JSON.parse(raw));
      } catch { return response({ error: "입력값을 확인해주세요." }, 400); }
      if (input.state.planner) {
        if(input.state.planner.records?.some(r=>r.date>localDate()))return response({error:"미래 일정의 수행 기록은 저장할 수 없어요."},400);
        const conflicts = validatePlanner(input.state.planner);
        if (conflicts.length) return response({ error: conflicts.join("\n") }, 400);
      }
      try {
        const revision = await repository.save(userId, JSON.stringify(input.state), input.revision);
        if (revision === null) return response({ error: "다른 창에서 데이터가 변경됐어요. 새로고침 후 다시 시도해주세요." }, 409);
        return response({ revision });
      } catch { return response({ error: "저장하지 못했습니다. 변경 내용을 유지한 채 다시 시도해주세요." }, 503); }
    },
    async DELETE(request: Request) {
      const userId = await identity();
      if (!userId) return response({ error: "로그인이 필요합니다." }, 401);
      if (!sameOrigin(request)) return response({ error: "같은 사이트에서 요청해주세요." }, 403);
      try { await repository.remove(userId); return response({ deleted: true }); }
      catch { return response({ error: "삭제에 실패했습니다. 다시 시도해주세요." }, 503); }
    },
  };
}
