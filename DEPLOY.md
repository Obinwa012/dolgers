# Deploy

The dashboard runs on Firebase App Hosting. The backend `dolgers` builds the folder `apps/web` from
the `main` branch (its configured root directory), so merging to `main` deploys it. Nothing else
needs a terminal or Cloud Shell.

## First run

1. Open https://dolgers--dolgers.us-central1.hosted.app and sign in with your Firebase account
   (email and password). If no admin exists yet, the first account to sign in becomes the admin;
   if your account was already an admin in the old dashboard, it still is.
2. **Settings → AliExpress:** enter the app key and secret, then **Connect AliExpress**. You approve
   DOLGERS on AliExpress and come back connected; the token then renews itself. The AliExpress
   app’s callback URL must be `https://dolgers--dolgers.us-central1.hosted.app/api/auth/ae/callback`
   (the same one the old dashboard used). Press **Test connection**.
3. **Settings → Claude:** paste a Claude API key from console.anthropic.com and press **Test**.
4. **Settings → DOLGERS rules:** the defaults are the rules agreed for the store; change any of them
   there.
5. **Import & vet:** run an import, then vet.

Keys saved before in the old dashboard (`config/secrets`) are picked up as they are.

## Good to know

- **Turn off public sign-up.** Firebase lets anyone create an email/password account with the
  site’s public key. They can’t get into the dashboard (only admins can), but to keep the account
  list clean: Firebase console → Authentication → Settings → User actions → untick *Enable create
  (sign-up)*. Add new admins from Settings → Admins instead.

- **Security rules.** The dashboard doesn’t depend on Firestore rules (its server uses the Admin
  SDK). The rules in `firebase/firestore.rules` close every collection to browsers except live
  products. To apply them, paste the file into Firebase console → Firestore → Rules → Publish.
- **Adding admins** (Settings → Admins) uses Firebase Authentication from the server. If it reports
  a permission error, give the App Hosting service account the *Firebase Authentication Admin* role
  in the Google Cloud console (IAM).
- **Rotate the AliExpress app secret** if it has ever been pasted into a chat or a ticket, then save
  the new one in Settings.
- **Costs:** a product that reaches the AI steps costs roughly 5–7 Claude calls (photo check, review
  analysis in chunks of 120 reviews, seller size chart, US size guide, listing). Most items stop at the
  free checks first. Pick cheaper or stronger models in Settings → Claude.
- **Daily Monitor:** the GitHub Action *Daily monitor* (`.github/workflows/monitor.yml`) calls the
  dashboard every 3 hours; the dashboard runs the Monitor when the last run is 20+ hours old. It
  needs no setup. To run it right away, use the Monitor button, or *Run workflow* on the Action.
- **Not automatic yet:** imports and vetting run when you press the buttons, and placing AliExpress
  orders automatically is a later phase.
