# HatStack — Claude Instructions

## Project
Task management dashboard organized by life "hats" (categories, not task type).
Hierarchy: Hat → Project → Task → Subtask.

## Response style
- Keep answers concise. Clearly state what you changed when you make a change.

## Scope discipline
- If something isn't specified, don't build it.
- Ask what's missing — be specific about what information is needed.

## Deployment
The dashboard runs on Cloudflare Workers (backend/data on Supabase). Code changes to
`dashboard/` are NOT live until deployed — `localhost:8080` and the production URL
(https://midoweno-hatstack-dashboard.reguo.workers.dev) run independent builds.

After making a change the user has confirmed looks right, deploy it so it's live on
their phone/other devices:
```
cd dashboard && npm run build && npx nitro deploy --prebuilt
```
If a change also requires a database migration, add a numbered file under
`dashboard/supabase/migrations/` and tell the user the exact SQL to run in the
Supabase SQL editor — migrations are not applied automatically.

Deploying (Cloudflare) and pushing to GitHub are unrelated actions — deploying does
NOT push, and pushing does NOT deploy. At the end of each work session (when the user
signals they're done, e.g. "I'm done for today"), do both:
1. Deploy: `cd dashboard && npm run build && npx nitro deploy --prebuilt`
2. Commit and push to `origin main`

Do this even if one of the two was already done mid-session, so both are guaranteed
current when the session ends.
