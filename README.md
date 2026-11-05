# Family Secret Santa

The family Secret Santa site at **xmas.trent.life**, running on Cloudflare's free tier.

- **Secret Santa** (`/`): sign in with your name and password to see who you're gifting, along with their wishlist. New people are pointed to create an account. Adults also see who the rest of their household is gifting.
- **Wishlists** (`/wishlists`): everyone's wishes, grouped by household. Only signed-in family can see this page.
- **My Account** (`/account`): family members create an account and edit their wishlist. Adults can also edit the lists of everyone else in their household (partner and kids).
- **Share links** (`/shared?t=…`): from My Account, you can turn on a read-only link to one person's list, for grandparents or friends without an account. You can replace the link or turn it off at any time.
- **Admin** (`/admin`, organizer only): edit family groups (add, rename, move, mark as kid, remove, reset sign-ins), sign in as someone to help with their list, draw names for a year, and see who has whom for any year.

## How it's built

| Piece | Where | Cloudflare product (free tier) |
| --- | --- | --- |
| Static pages | `public/` | Pages (static requests are free and unlimited) |
| API | `functions/api/` + shared code in `lib/` | Pages Functions (100,000 requests/day) |
| People, accounts, wishes, draws, share links | `migrations/` | D1 SQLite (5 GB, 5M row reads and 100k row writes per day) |
| Draw algorithm and its tests | `lib/draw.js`, `test/` | Runs inside the API; `npm test` runs the tests locally |

It uses Pages rather than a Worker because trent.life's DNS stays at Google: Pages accepts a plain CNAME for a subdomain, while a Worker custom domain needs the whole zone moved to Cloudflare.

### Accounts

- **Signing up:** you type your first name the way it appears on the family list, choose a password (8 characters or more), and enter your **family code**. Capital letters and extra spaces don't matter in names or codes.
- **Family codes:** each family group has its own code, like `jolly-reindeer-42` (about 175,000 possibilities). A code only works for names in its own group, so nobody can claim someone else's name. The app makes the codes; the organizer sees them on the Admin page and can replace one if it gets out. The organizers themselves (names in `ADMINS`) can only sign up with the **setup code** (`SETUP_CODE`, a Cloudflare secret). That way nobody else can claim an organizer's name, and the organizer can make their account before seeing any codes.
- **Households and kids:** each person belongs to a household (a family group) and is either an adult or a kid. Adults manage everyone in their household, partner and kids alike: their lists, their share links, and seeing their Secret Santa person. Adults can also remove household members without their own account who aren't in this year's draw. Only the organizer adds people, from the Admin page. Kids only see and change their own list and their own person. Everyone signed in, kids included, can read the Wishlists page.
- **Who can see wishes:** signed-in family can see every list. Anyone else needs a share link, which shows one person's list.
- **Passwords:** stored as PBKDF2-SHA256 hashes with a per-user salt, using 25,000 iterations. Even a password change, which checks the old password and hashes the new one, stays under the free plan's 10 ms CPU limit per request. The iteration count is stored with each hash, so it can be raised later.
- **Sessions:** an HttpOnly cookie that lasts 90 days. Only a hash of the token is stored.
- **Throttling:** each attempt is counted before the password or code is checked, so a burst of parallel requests can't slip past. The limits:
  - Sign-in: 10 wrong passwords per name per device. A stranger can't lock you out from their own device, and there are backstops of 30 per device and 50 per name across all devices.
  - Sign-up: 10 tries per device and 20 per family group.
  - Admin password (for **Sign in as**): 5 wrong tries per organizer and 10 per device.
  - Each limit lasts 15 minutes, except the family-group and admin-password limits, which last an hour.
- **Organizer:** the names in `ADMINS` in `wrangler.toml` (currently `Jeff`) get the **Admin** page, and an Admin link in the nav once signed in.
- **Signing in as someone:** an organizer can click **Sign in as** next to anyone on the Admin page, to see the site as they do or fix their list for them. That includes people who haven't made an account yet, for example to fill in a list for someone who won't sign up. It asks for the **admin password** (`ADMIN_PASS`, a Cloudflare secret) every time, on top of the organizer's own sign-in. The organizer's session is swapped for a one-hour session as that person. The session still belongs to the organizer's account, so the other person needs no account. A banner on every page says who you're signed in as, and **Back to Jeff** swaps back. While signed in as someone you can't use the Admin page or change their password, and you can't sign in as another organizer. Changing the organizer's password, or removing the person, ends these sessions. Taking the organizer out of `ADMINS` stops them working straight away.

### The draw

Nobody gets themselves or someone from their own household. Compared with the previous year's draw, the draw also:

1. Avoids giving anyone the same person as last year. This is a much stronger rule than the next one.
2. Gives each household people from different families than last year, wherever possible. For example, if someone in Greg's household gave to someone in Jeff's household last year, it tries not to repeat Greg's household → Jeff's household.

It solves this as an assignment problem (the Hungarian algorithm), so the result always has the fewest repeats possible. Random noise picks a different draw each time among the best ones.

With the current households, some household repeats are unavoidable. For example, Greg's household has 5 people, more than the other families they didn't give to last year can take. The Admin page tells you how many repeats there are and marks them in **Who has whom**.

Draws are kept by year, and the newest year is the one people see when they sign in. The Admin page shows how many people are in the draw and who can't see their person yet (no account, and no adult in their household has one). **Who has whom** stays hidden until you click to show it, and you can delete a draw made by mistake. Deleting the newest year brings back the year before.

**Who sees whose person:** you always see your own. Adults also see everyone else in their household (partner and kids), so they can shop together. Kids only see their own.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars        # sets SETUP_CODE and ADMIN_PASS for local testing
npm run db:migrate:local              # creates the tables and seeds the family
npm run dev                           # http://localhost:8788
npm test                              # draw algorithm tests
```

To try the home page locally, load a draw with `npx wrangler d1 execute secret-santa --local --file draw-2026.sql`, or sign up as Jeff and draw names from My Account.

To start over with a fresh local database, run `rm -rf .wrangler/state`, then `npm run db:migrate:local` again.

## One-time Cloudflare setup

1. **Log in to Cloudflare.**
   ```bash
   npx wrangler login
   ```
2. **Create the database.** Copy the `database_id` this prints into `wrangler.toml`, replacing the zeros, then commit the change.
   ```bash
   npx wrangler d1 create secret-santa
   ```
3. **Create the tables and load the family.**
   ```bash
   npm run db:migrate:remote
   ```
4. **Create the Pages project from GitHub.** In the dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**, then pick `thejefftrent/secret-santa`.
   - Production branch: `main`
   - Framework preset: None
   - Build command: leave it empty
   - Build output directory: `public`

   Pages reads the D1 binding from `wrangler.toml`, and every push to `main` deploys the site. Then go to **Settings → Builds → Branch control** and set preview branches to **None**. Preview builds would use the same live database, and their URLs stay up after you fix something.
5. **Set the setup code.** Only organizers use it, once, to make their own account. Pick something only you know.
   ```bash
   npx wrangler pages secret put SETUP_CODE --project-name secret-santa
   ```
   You can also set it under the project's **Settings → Variables and Secrets**. Redeploy afterwards (**Deployments → … → Retry deployment**) so the site picks it up. Once your account exists, you can delete the secret, but an organizer whose sign-in is reset will need it again.

   Set the **admin password** the same way. The Admin page asks for it whenever an organizer signs in as someone else. Make it long, and different from your own password. Without it, **Sign in as** is turned off.
   ```bash
   npx wrangler pages secret put ADMIN_PASS --project-name secret-santa
   ```
6. **Load this year's draw.** The 2026 names were already drawn, so the 2026 draw is imported exactly as it was rather than drawn again. The import file is gitignored because it says who has whom. Run this from the folder that holds `draw-2026.sql`, then delete the file.
   ```bash
   npx wrangler d1 execute secret-santa --remote --file draw-2026.sql
   ```
   To rebuild the file from the old script's output, run `node scripts/import-draw.js 2026 secretlist.json draw-2026.sql`.
7. **Test the `*.pages.dev` address.** Use the URL Cloudflare shows for the project. It's usually `secret-santa.pages.dev`, but Cloudflare adds a suffix if that name is taken. Sign up as Jeff with the setup code, add a wish, and check the home page shows your Secret Santa person. Then open **Admin**, copy each family group's sign-up code, and send each group its own.
8. **Move xmas.trent.life over.**
   1. In the Pages project, go to **Custom domains → Set up a custom domain** and enter `xmas.trent.life`. Do this before changing DNS. If you change DNS first, the domain shows a 522 error.
   2. Where trent.life's DNS is managed (the Google Cloud DNS name servers), change the `xmas` CNAME from `www.thejefftrent.com` to your `*.pages.dev` hostname.
   3. Wait for the custom domain to show **Active** in Pages.
9. **Turn off GitHub Pages and make the repo private.** In the GitHub repo:
   - Go to **Settings → Pages** and unpublish the site.
   - Under **Settings → General**, change the visibility to private.

   The repo is public today. Its history holds the old `docs/index.js`, whose 2026 pairs can be decoded offline, and the seeded names and wishes. Making it private stops casual access. Cloudflare Pages builds from private repos too.

## Every year

1. Make sure everyone is on the site. New babies and partners, new households and anyone moving all go through **Admin → Family groups**.
2. Sign in as Jeff and go to **Admin → Secret Santa draw**:
   - Check the year.
   - Untick anyone sitting this year out.
   - Click **Draw names**.
3. Tell everyone to sign in on the home page to see their person. The panel lists anyone who can't see theirs yet. Nothing needs committing or deploying.
4. Optionally, clear last year's wishes:
   ```bash
   npx wrangler d1 execute secret-santa --remote --command "DELETE FROM items"
   ```

## Admin

Most of the upkeep happens on the **Admin** page:

- **Someone forgot their password:** **Family groups → Reset sign-in**. They sign up again with their family group's code, and their wishes are kept.
- **Someone needs help with their list, or you want to see what they see:** **Family groups → Sign in as**, then type the admin password (`ADMIN_PASS`). You land on their My Account page, signed in as them for up to an hour. Click **Back to Jeff** in the banner when you're done.
- **A family code got out:** **Family groups → New code** next to that group. The old code stops working, and existing accounts aren't affected.
- **New person, new household, or someone moving:** **Family groups → Add someone** (pick their family group, or "+ New family group") or **Edit**. Only the organizer can add people. If moving someone puts a giver and their giftee in the same household, the page warns you, without saying who.
- **Kid grew up:** **Edit**, then untick **Kid**.
- **Removing someone:** first draw the current year again without them, then **Remove** them. Their account, wishes and share link go too.

Organizers are matched by name, so an organizer can't be renamed or removed until they're taken out of `ADMINS`.

These are command-line only. Drop `--remote` to run them locally instead.

**Let someone else run the draw.** Add their name to `ADMINS` in `wrangler.toml`, for example `"Jeff, Erinn"`, then push.

**Back up everything.**
```bash
npx wrangler d1 export secret-santa --remote --output backup.sql
```

**Change the database schema.** Add a new numbered file in `migrations/`, then run `npm run db:migrate:local` and `npm run db:migrate:remote`. Run the remote migration before you push the code that needs it: every push to `main` deploys straight away.
