# Rams Transfer Hub v2

A free, unofficial Derby County transfer dashboard for GitHub Pages.

## New in v2

- **Most Linked / Top Targets board**
- Automatically attempts to identify player names from transfer headlines
- Weighted **Target Score** from 25–99
- Target statuses: **Hot, Strong, Developing, Watch, Fading, Signed**
- **NEW NAME** badge for players first detected in the last 12 hours
- Number of independent sources reporting each target
- Best source and latest mention displayed
- Click any player to instantly filter the full news feed to that player
- No separate database required

## Existing features

- Countdown to **1 September 2026, 23:00 BST**
- Google News RSS scan every five minutes with GitHub Actions
- Multiple country/language editions
- Story Source and Likelihood scores
- Confirmed / Strong / Rumours / Overseas filters
- Live ticker
- Browser checks for newly generated data every minute
- No paid API keys

## How the target score works

The target score is deliberately transparent. It rewards:

1. **Independent reporting** — multiple different outlets matter more than copied stories
2. **Source quality** — BBC/Sky/official/local specialists count more than weak aggregators
3. **Recency** — fresh links rank above old rumours
4. **Story strength** — "medical", "advanced talks" and "deal agreed" rank above "could" or "linked"
5. **Corroboration** — one weak report cannot reach an extreme score

This is an automated rumour score, not a factual probability that a transfer will happen.

## Do I need Firebase or another database?

**No.**

GitHub Actions runs the updater and writes the latest state to:

`data/news.json`

GitHub Pages serves that JSON to the app.

For this use case it is effectively acting as a tiny free datastore.

A real database only becomes useful later if you want things like user accounts, personal watchlists, push notifications, comments, saved preferences or a long-term searchable archive.

## Put it live

1. Create a public GitHub repository.
2. Upload every file/folder from this project to the repository root.
3. Go to **Actions** and run **Refresh Derby transfer news** once.
4. Go to **Settings → Pages**.
5. Choose **Deploy from a branch**.
6. Choose `main` and `/ (root)`.
7. Save.
8. Open the Pages URL GitHub gives you.

## Updating an older v1 upload

If you already uploaded the previous version, replace:

- `index.html`
- `styles.css`
- `app.js`
- `scripts/update-news.mjs`
- `data/news.json`

The existing `.github/workflows/update-news.yml` can stay.

Then manually run the Action once.

## Important limitation: name extraction

The project uses a lightweight rules-based player-name detector so it stays free and needs no AI API.

It works best on normal football headlines such as:

- Derby County linked with Hamza Choudhury
- Rams target Mikey Johnston
- Derby make bid for John Smith

It can occasionally mistake another person's name for a player. The scoring system limits the damage because a name normally needs repeated independent reporting to rise up the board.

A future upgrade could add a free football player list to validate names.

## X / Twitter

This project does not scrape X directly. Reliable full X search is not something a static free GitHub Pages app can safely depend on.

Stories originating on X are often repeated by news sites and then enter Google News, which means many still appear indirectly.

## Source scores

Edit `SOURCE_RULES` in:

`scripts/update-news.mjs`

You can add specific journalists as well as outlets.
