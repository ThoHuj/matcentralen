# Matcentralen

A small web app for planning grocery shopping at home. Keep your recipes in one place, pick what to cook
and for how many, and get one combined shopping list. The interface is in Swedish and uses Swedish units.

- **Recipes** – add by hand, or paste a link and let an AI model (via OpenRouter) read the page.
- **Shopping list** – choose recipes and servings; the same ingredient across recipes is summed into one line
  (g/kg and ml/dl/l/msk/tsk are converted and added together).
- **Own items** – type things like `2 l mjölk` or `diskmedel` straight into the list.
- **What you have at home** – tick an item off, or enter the amount you already have and only the rest stays on the list.
- **Real servings** – when a recipe turns out to feed more or fewer than it claims, correct the number on the
  recipe page ("Stämmer det inte?"). Amounts stay as written; the list scales from the corrected number.
- **Shared** – the list updates live in every open browser, so two people can tick things off at once.
- **Looks** – six themes, each in light and dark. Chosen per device.
- **Suggestions** – a "Förslag" button lets anyone in the household send an idea for changing the app to a
  Discord channel.

## Run it

Requires Docker with the Compose plugin.

```sh
cp .env.example .env      # then put your OpenRouter key in .env
docker compose up -d --build
```

Open `http://<server>:3000`.

### Settings (`.env`)

| Variable             | Default                       | What it does                                                        |
| -------------------- | ----------------------------- | ------------------------------------------------------------------- |
| `OPENROUTER_API_KEY` | empty                         | Key from <https://openrouter.ai/keys>. Without it, link import is off. |
| `OPENROUTER_MODEL`   | `anthropic/claude-sonnet-5.5` | Model that reads recipes. Any OpenRouter model id works.            |
| `DISCORD_WEBHOOK_URL` | empty                        | Discord webhook that receives suggestions. Without it, the "Förslag" button is hidden. Treat it as a secret. |
| `PORT`               | `3000`                        | Port on the host.                                                   |

After changing `.env`, run `docker compose up -d` again.

### Data and backup

Everything is stored in one SQLite file, `/data/matcentralen.db`, in the `matcentralen-data` volume.
To take a copy:

```sh
docker compose stop
docker compose cp matcentralen:/data/matcentralen.db ./matcentralen-backup.db
docker compose start
```

### Updating

```sh
docker compose up -d --build
```

The database is kept between builds.

## Good to know

- **There is no login.** Anyone who can reach the port can read and change everything, and trigger AI imports
  on your key. Keep it on your home network or behind a VPN or an authenticating reverse proxy.
- **Importing from a link** fetches the page on the server and sends its text to the model. Some sites block
  automated fetching; use the "Text" tab and paste the recipe instead.
- Imported recipes open in the edit form first, so you can check them before saving.
- Ingredients are matched by name. "lök" and "gul lök" are different items; the import is told to reuse names
  you already have, and the edit form suggests them as you type.
- The store section of an item is guessed from its name. Change it by opening the item in the list; the app
  remembers your choice for that item.

## Development

Needs Node 24 or later.

```sh
npm install
npm run dev:server   # API on :3000 (reads OPENROUTER_API_KEY from the environment)
npm run dev:web      # web UI on :5173, proxies /api to :3000
npm test             # server tests
npm run build        # type-check and build the web UI into dist/
```

Layout:

- `server/` – Express API. `list.js` builds the shopping list, `units.js` handles units, `importer.js` does the AI
  import, `suggestions.js` posts suggestions to Discord.
- `web/` – React front end. Themes live in `web/src/styles/themes.css`; adding one means adding a block of
  variables there and an entry in `THEMES` in `web/src/hooks.ts`.
