# Deploy

## 1. Firebase

```bash
npx firebase use staging                 # or production
npx firebase deploy --only firestore     # rules + indexes
```

Admins need the custom claim `admin: true` to read the review queue. Set it once with the Admin
SDK, for example `getAuth().setCustomUserClaims(uid, { admin: true })`.

## 2. AliExpress tokens (do this once)

Tokens pasted by hand expire after about a day and **can't renew themselves**. Connect the app
properly so a refresh token is stored:

```bash
npm run pipeline -- auth url --redirect <the callback URL registered on your AliExpress app>
# open the link, approve, copy `code` from the address bar of the page you land on
npm run pipeline -- auth exchange <code>
npm run pipeline -- auth status     # must say "refresh token present"
```

## 3. Secrets

Put these in Secret Manager and expose them to the job as environment variables:

- `AE_APP_KEY`
- `AE_APP_SECRET`
- `ANTHROPIC_API_KEY`

Firestore access uses the job's service account (Application Default Credentials); give it
**Cloud Datastore User** on the project. Rotate the AliExpress app secret if it has ever been
pasted into a chat or a ticket.

## 4. Cloud Run job and schedule

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT/dolgers/pipeline -f apps/pipeline/Dockerfile .
gcloud run jobs create pipeline --image us-central1-docker.pkg.dev/PROJECT/dolgers/pipeline \
  --region us-central1 --task-timeout 3600 --max-retries 0 \
  --set-env-vars GCLOUD_PROJECT=PROJECT \
  --set-secrets AE_APP_KEY=AE_APP_KEY:latest,AE_APP_SECRET=AE_APP_SECRET:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest
```

Then add Cloud Scheduler triggers that run the job with different arguments:

| When | Arguments | Why |
| --- | --- | --- |
| Daily 05:00 | `import --department men --pages 10` and the same for `women` | New items enter the queue. |
| Hourly | `run --limit 25` | About 25 products per hour stays well under AliExpress's rate limit (about 1 call/second). |
| Daily 07:00 | `monitor` | Price, stock, seller and rating checks; pauses what changed. |

The Docker image hasn't been built in this environment yet; build it once in Cloud Build before
you schedule anything.

## 5. Costs to expect

- **Claude:** a product that reaches the AI steps costs roughly 5 calls (image check, review analysis, seller size chart, US size chart, listing). Most candidates stop earlier, with no AI cost.
- **Model choice:** set `AI_MODEL_FAST` / `AI_MODEL_CAREFUL` to trade cost against quality.
- **Firestore:** a few documents per product, with no hot spots.
