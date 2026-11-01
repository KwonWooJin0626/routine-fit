# Book and music recommendations

The first release uses official Aladin category bestseller pages and activity-specific YouTube search links, as explicitly selected by the user. It does not invent book titles, ranks, tracks, or watched/read outcomes. No provider keys are required in this mode.

## User flow

- Routine cards expose “책 추천 받기” / “음악 추천 받기” inside expanded catalog cards and next to active routines. A single accessible dialog contains the chooser.
- Context uses the routine's activity domain, stable ID and bedtime timing; the user may change it. Initial recommendations show three categories; all categories and alternative sets are available.
- Aladin categories: poetry 50940, essay 55889, logic 51412, healing 70236, relationships 2951, happiness 70211. Fiction uses Korean 50917, English/American 50919 or Japanese 50918. The actual subcategory is shown.
- The official bestseller page opens with its original ranking. In link mode users inspect the top ten there; Routine Fit does not claim to have fetched a live top ten or enforce the provenance of a manually entered book.
- Users can register a chosen or already owned book with title, author, category and optional HTTPS Aladin URL; mark reading, finished or paused. Registered books remain independent of changing rankings. Registering/changing status does not award pet XP or mark routines complete.
- Music search combines a fixed activity term with the selected genre. Genre and vocal tags are editorial routing hints, not verified properties of every returned video. External viewing is explicit; no autoplay or audio extraction.
- Preferences are optional, multi-select and can be edited in the dialog or Settings. Day/category reactions aggregate once; opening a link is weak interest, not completion. Like/dislike can be toggled off. Reaction storage is bounded to 200 rows over 90 days. Individual video taste/artist learning is not claimed in this first link-based version.

## Ranking and storage

Without selected interests, category score stays .40 context fit + .30 explicit taste + .20 smoothed category feedback + .10 new-choice opportunity. With interests, books use .25 context + .20 genre taste + .35 interest + .10 feedback + .10 novelty; music uses .40 context + .25 genre taste + .15 interest + .10 feedback + .10 novelty. The first book category in a topic mapping is its direct match (1), other related book categories receive .25; music matches receive 1. Interest match is bounded at 1, so selecting multiple matching topics does not multiply the bonus. This prevents a broadly related category such as essays from crowding out direct relationship/happiness choices; music keeps activity fit as its strongest component. These are experimental editorial coefficients, not an accuracy estimate. Vocal preference gates incompatible categories before ranking. Book and music feedback are separate. Books are not ranked by an invented global Top 10.

The optional `media` field is Zod-validated within the existing authenticated Clerk/Neon AppState, with the same optimistic revision checks, export and full reset as other app data. There is no additional database migration. Read-state, pet projections, old imports and onboarding preserve optional media preferences through the existing state schema. URLs are restricted to known HTTPS Aladin hosts without credentials; titles are rendered as React text.

## Optional provider adapters

`GET /api/media` requires a verified Clerk session and accepts only a known kind/category/context/novel selection. No health answers or user identity are sent to external providers. Arbitrary query strings and arbitrary provider URLs are not accepted.

Aladin officially ended new key issuance on 2026-09-04 and the entire OpenAPI on 2026-10-30: https://blog.aladin.co.kr/cscenter/17483675 (verified 2026-11-01). Do not request or provision `ALADIN_TTB_KEY`. Books always return official category links and manually registered titles, never fabricated live rankings. No scraping fallback is enabled.

Server-only `YOUTUBE_API_KEY` enables predefined activity/genre searches followed by videos metadata checks (duration, public status, non-live, Korea availability where specified). The UI distinguishes video length from today's listening time. This does not verify lyrics, loudness changes, advertising, uploader rights or a therapeutic property of an individual track.

Provider fetches use Next server data caching with a 24-hour revalidation interval and an 8-second timeout. Failures return official links without provider error bodies or keys. Before enabling the YouTube adapter widely, check the project's quota against active query combinations and add a refresh budget if required; cache revalidation alone is not a global quota limit. Live external responses still require a real-key smoke test after credentials are added. Current integration tests cover link mode and mocked provider parsing/failures.

## Verification

- `node scripts/test-engine.mjs`: category links, context/vocal gating, reaction deduplication and cancellation, safe storage, YouTube metadata, missing-key/failure behavior and regression suite.
- `node --env-file=.env.local scripts/verify-media.mjs`: development-only synthetic Clerk accounts -> HTTP -> Neon -> restore, account isolation, CSRF/CAS, book status and reset. Deletes only its own fixtures.

Existing empty routine reference rows are hidden; question provenance is unchanged. Existing music guidance background links remain available. Three concrete reading activities were added for logic, relationships and self-care, preserving previous routine IDs and progress.

## Vercel activation

1. In Google Cloud create/select a project, enable YouTube Data API v3, and create an API key. Restrict API access to YouTube Data API v3. This server integration does not use a browser HTTP-referrer restriction; IP restrictions require an actual stable egress IP.
2. In the routine-fit Vercel project, Settings → Environment Variables, add `YOUTUBE_API_KEY` as a Production secret. Never share its value in chat or commit it.
3. Redeploy Production, then verify actual video results as an authenticated user. Before that, live behavior remains unverified and the official search links remain available.

Google instructions: https://developers.google.com/youtube/registering_an_application

## Current interests

The activity refinement wizard includes one optional, shared question after route selection and before choosing activity domains. All ten topics can be selected independently of the two-domain activity limit: relationships, growth, health, happiness, mind, learning, career, creativity, stories and life. Next saves interests immediately via the existing authenticated state endpoint; no activity category needs to be completed to retain them. Existing pending category surveys resume without requiring the extra question; interests remain editable in Settings and the content dialog.

`media.interests` defaults to an empty array for old payloads. Duplicate/unknown values are rejected. Existing book entries, genres, reactions, routines and completion records are preserved. Clearing interests restores the prior ranking formula. Content selection explains matching interests; vocal preferences still filter incompatible music genres first.

Topic-to-category mappings are editorial suggestions, not claims about an individual book's content or a track's lyrics or health effects. Health interest is not interpreted as a medical condition or nutrient deficiency. Only existing book categories are used; no new health-book collection or automated content retrieval is claimed. Interest IDs stay in the account state and are not added to external search queries. No additional API or paid service is introduced.
