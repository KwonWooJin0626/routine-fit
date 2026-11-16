import { z } from "zod";

const legacyLinkSchema = z.record(z.string().uuid(), z.string().regex(/^user_[A-Za-z0-9]{1,100}$/));

export function parseLegacyAccountLinks(raw: string | undefined) {
  const links = legacyLinkSchema.parse(raw ? JSON.parse(raw) : {});
  const owners = new Set(Object.values(links));
  if (owners.size !== Object.keys(links).length ||
      Object.keys(links).some((key) => key !== key.toLowerCase())) {
    throw new Error("Invalid legacy account links.");
  }
  return new Map(Object.entries(links));
}
