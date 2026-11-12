# The ladder (Cloudflare Worker + D1)

The game posts career scores here and reads the top of each board. Free tier is plenty.

## Set up (once, about fifteen minutes)

In the Cloudflare dashboard:

1. **Storage & Databases > D1 > Create database.** Name it `sm91-ladder`. Open it, go to **Console**, paste the contents of `schema.sql` and run it.
2. **Workers & Pages > Create > Create Worker.** Name it `sm91-ladder`, click Deploy, then **Edit code**. Replace everything with the contents of `worker.js` and click **Deploy**.
3. On the Worker's page go to **Settings > Bindings > Add > D1 database**. Variable name `DB`, database `sm91-ladder`. Save.
4. Still in Settings, under **Variables and Secrets** add two:
   - `ALLOWED_ORIGIN` = your GitHub Pages origin, e.g. `https://yourname.github.io` (or `*` while testing)
   - `ADMIN_KEY` = any long random string. This is what lets you delete entries.
5. Copy the Worker's URL from its overview page (it looks like `https://sm91-ladder.yourname.workers.dev`) and send it to Claude, or paste it into `index.html` as `LADDER_URL`.

Test it: open `https://sm91-ladder.yourname.workers.dev/top?board=career` in a browser. You should see `{"ok":true,"board":"career","rows":[]}`.

If you'd rather use the command line: `npm i -g wrangler`, `wrangler login`, `wrangler d1 create sm91-ladder` (paste the id into `wrangler.toml`), `wrangler d1 execute sm91-ladder --file=schema.sql`, `wrangler deploy`, then `wrangler secret put ADMIN_KEY`.

## Deleting a cheat

Open this in a browser, with your key and the player id shown on the entry:

`https://sm91-ladder.yourname.workers.dev/entry?player=THE-ID&key=YOUR-ADMIN-KEY` using the DELETE method (curl: `curl -X DELETE "https://.../entry?player=THE-ID&key=YOUR-ADMIN-KEY"`). Add `&board=career` to remove one board only.

## Boards

- `career`: points for trophies and promotions, higher is better.
- `fastest_title`: seasons from a random Division 4 start to the Division 1 title, lower is better.
- `fastest_euro`: seasons from a random Division 4 start to a European trophy.

Only classic starts count on the two "fastest" boards.
