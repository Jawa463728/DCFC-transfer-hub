# Rams Transfer Hub

A free, unofficial Derby County transfer-news dashboard designed for GitHub Pages.

## What it does

- Transfer deadline countdown to **1 September 2026, 23:00 BST**
- Scans Google News RSS every five minutes with GitHub Actions
- Searches multiple country/language editions
- Gives every story a **Source** score and a **Likelihood** score
- Separates confirmed reports, strong stories, rumours and overseas discoveries
- Browser refreshes the latest generated JSON every minute
- No paid API key required

## Put it live

1. Create a **public** GitHub repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Actions → General** and ensure Actions are allowed.
4. Open the **Actions** tab → **Refresh Derby transfer news** → **Run workflow** once.
5. Open **Settings → Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Choose your default branch (`main`), folder `/ (root)`, then Save.
8. GitHub will show your live Pages URL after deployment.

The updater then runs on a `*/5 * * * *` schedule.

## Important limitation: X / Twitter

This version deliberately does not scrape X. Reliable live X search is not something a static GitHub Pages site can safely or consistently do for free. Unauthenticated scraping is brittle and may breach platform controls; API access can also change or cost money.

The practical free workaround is stronger than it sounds: Google News often picks up stories that originate with journalists on social media, and this project scans multiple Google News country editions. You can also add particular journalists/outlets to `SEARCHES` or `SOURCE_RULES` in `scripts/update-news.mjs`.

## Adjusting source scores

Edit `SOURCE_RULES` in `scripts/update-news.mjs`.

The first matching rule wins:

```js
[/BBC Sport|BBC/i, 94],
[/Derbyshire Live|Derby Telegraph/i, 87],
[/TEAMtalk/i, 64],
```

Scores are intentionally transparent rather than pretending to be AI certainty.

## Adding a journalist or outlet

Add a more specific Google News search to the `SEARCHES` array, for example:

```js
{ edition:"gb", hl:"en-GB", gl:"GB", ceid:"GB:en", q:'"Derby County" "John Percy"' }
```

## Notes

GitHub's minimum scheduled workflow interval is five minutes, but scheduled jobs can occasionally start late. The website itself checks the generated feed every minute, so visitors see a new update as soon as GitHub publishes it.

This is an unofficial supporter project and is not affiliated with Derby County Football Club.

## Target-board exclusions

The **Most Linked** board is intended to show active targets only.

It now automatically excludes:

- Players already detected as **signed/completed**
- Obvious football club names such as Blackburn Rovers
- Derby staff / non-player personnel included in `NON_PLAYER_PHRASES`
- Names containing common club terms such as United, City, Rovers, Wanderers, Athletic, Albion, County and Town

Completed signings can still remain in the main news feed; they are simply removed from the live target ranking.
