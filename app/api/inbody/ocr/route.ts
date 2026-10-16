import { getSessionUser } from "@/lib/auth";
import { extractInbody } from "@/lib/engine";

export async function POST(request: Request) {
  if (!await getSessionUser()) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "잘못된 요청입니다." }, { status: 403 });
  if (!process.env.GOOGLE_VISION_API_KEY) return Response.json({ error: "이미지 자동 인식은 아직 연결되지 않았어요. 결과지를 보며 아래 수치를 직접 입력할 수 있어요.", code: "OCR_NOT_CONFIGURED" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 4_000_000) return Response.json({ error: "자동 인식은 2.8MB 이하 이미지를 사용해주세요. 더 큰 이미지는 수치를 직접 입력할 수 있어요." }, { status: 413 });
  let content: string;
  try {
    const input = JSON.parse(raw);
    if (typeof input.content !== "string" || !/^[A-Za-z0-9+/=]+$/.test(input.content)) throw new Error();
    content = input.content;
    const sig = atob(content.slice(0, 32));
    if (!(sig.startsWith("\x89PNG") || sig.startsWith("\xff\xd8\xff") || (sig.startsWith("RIFF") && sig.slice(8, 12) === "WEBP"))) throw new Error();
  } catch { return Response.json({ error: "PNG, JPG, WEBP 이미지를 선택해주세요." }, { status: 400 }); }
  try {
    const upstream = await fetch("https://vision.googleapis.com/v1/images:annotate", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_VISION_API_KEY }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ requests: [{ image: { content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }),
    });
    if (!upstream.ok) throw new Error();
    const data = await upstream.json() as { responses?: { fullTextAnnotation?: { text?: string }; error?: unknown }[] };
    if (data.responses?.[0]?.error) throw new Error();
    const text = data.responses?.[0]?.fullTextAnnotation?.text;
    if (!text) return Response.json({ error: "글자를 읽지 못했어요. 선명한 사진이나 직접 입력을 이용해주세요." }, { status: 422 });
    return Response.json({ values: extractInbody(text), needsConfirmation: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "자동 인식에 실패했어요. 수치를 직접 입력할 수 있어요." }, { status: 502 }); }
}
