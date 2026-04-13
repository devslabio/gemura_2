# Kwezi deployment – what happened and which script to use

## What we ran

We ran the **combined** script:

```bash
./scripts/orora/deployment/deploy-orora-and-backend-to-kwezi.sh
```

That script does **two steps in order**:

1. **Step 1:** `deploy-gemura-only-safe.sh` (Backend + Gemura Web to `/opt/gemura`)
2. **Step 2:** `deploy-orora-web.sh` (Orora Web to `/opt/orora`)

## Why Gemura web went down

- **Step 1** does:
  1. Rsync backend + gemura-web to `/opt/gemura`
  2. On the server: `docker compose -f docker/docker-compose.kwezi.yml down --timeout 20`  
     → **Stops both `gemura-api` and `gemura-ui`**
  3. Then: `docker compose ... up -d --build`  
     → Rebuilds both images and starts both containers

- The **build is long** (Gemura UI Next.js ~5+ min, backend npm ci + build several more minutes). The deploy was run in the background and likely **timed out or was interrupted** before `up -d --build` finished.

- So the sequence was: **containers stopped** by `down`, then build started but **never completed** (or script was killed). Result: **both Gemura API and Gemura Web stayed down**.

- **Step 2 (Orora)** only deploys to `/opt/orora` and runs `docker compose` there. It does **not** stop or restart Gemura. So Orora deploy is not the cause of Gemura being down.

## Deploy each app alone (per-app scripts)

You have scripts to deploy **only** the app you changed:

| Goal | Script | What it does |
|------|--------|--------------|
| **Gemura Web only** | `./scripts/gemura/deployment/deploy-gemura-web-only.sh` | Rsyncs `apps/gemura-web`, then on server: `docker compose ... up -d --build gemura-ui`. Does **not** stop or rebuild `gemura-api`. |
| **Gemura Backend only** | `./scripts/gemura/deployment/deploy-gemura-backend-only.sh` | Rsyncs `backend`, then on server: `docker compose ... up -d --build gemura-api`. Does **not** stop or rebuild `gemura-ui`. |
| **Both Gemura API + Web** | `./scripts/shared/deployment/deploy-gemura-only-safe.sh` | Rsyncs both, then `down` + `up -d --build` for both. Use when both changed or after a bad state. |
| **Full stack (Gemura + Orora)** | `./scripts/orora/deployment/deploy-orora-and-backend-to-kwezi.sh` | Runs safe Gemura deploy then Orora Web. Use only when you need to deploy both; let it run to completion (no timeout). |

## How to fix Gemura web now

**Option A – Only bring back Gemura Web (if backend is already up):**

```bash
./scripts/gemura/deployment/deploy-gemura-web-only.sh
```

**Option B – Bring back both API and Web (recommended if both are down):**

```bash
./scripts/shared/deployment/deploy-gemura-only-safe.sh
```

Run it in the **foreground** and wait until you see “✅ Safe deployment complete” (can take 10–15+ minutes).

## Recommendation

- For **only Gemura changes**: use **Option A** or **Option B** as above; avoid the combined Orora+Backend script unless you are deploying Orora too.
- For **only Orora changes**: use `./scripts/orora/deployment/deploy-orora-web.sh`.
- When running any full deploy (`deploy-gemura-only-safe.sh` or `deploy-orora-and-backend-to-kwezi.sh`), run in foreground and let it finish; do not rely on a short timeout.
