# Routování v aplikaci Ping Pong Turnaje

Aplikace používá History API pro client-side routování. Každá obrazovka a modal s vlastní URL má vlastní cestu – lze odkazovat, sdílet a obnovit stránku bez ztráty kontextu.

## Mapování URL

| URL | Obrazovka | Popis |
|-----|-----------|-------|
| `/` | Hlavní obrazovka | Seznam turnajů |
| `/tournament/new` | Modal nového turnaje | Vytvoření nového turnaje |
| `/tournament/:id` | Obrazovka turnaje | Detail turnaje, seznam zápasů |
| `/tournament/:id/settings` | Modal nastavení turnaje | Úprava názvu, hráčů, kopírování |
| `/tournament/:id/stats` | Statistiky turnaje | Žebříček, matice zápasů |
| `/tournament/:id/match/:matchId` | Herní obrazovka | Zápis bodů, scoreboard |
| `/players` | Databáze hráčů | Seznam hráčů |
| `/players/new` | Modal nového hráče | Přidání hráče |
| `/players/:id` | Modal úpravy hráče | Editace hráče |
| `/stats/overall` | Celkové statistiky | Statistiky napříč turnaji |

## Base path

- **Localhost:** `/a/ping/` – plné URL např. `http://localhost/a/ping/tournament/123`
- **Produkce (root):** `/` – plné URL např. `https://example.com/tournament/123`

Base path se detekuje automaticky podle `window.location.pathname`.

## Technické detaily

### Modul `js/router.js`

- `getBase()` – vrací base path
- `parseRoute(path)` – parsuje cestu na objekt `{ name, tournamentId?, matchId?, playerId? }`
- `buildPath(route)` – sestaví plnou cestu
- `navigate(route, replace)` – `history.pushState` / `replaceState`
- `navigateTo(route)` – navigace + vykreslení (volá `applyRoute`)
- `initRouter(applyRoute)` – registruje listener na `popstate`
- `isModalRoute(route)` – `true` pro `tournament-new`, `tournament-settings`, `player-new`, `player-edit`

### Serverová konfigurace

**Apache (.htaccess):**
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . index.php [L]
```

Všechny požadavky na neexistující soubory/adresáře směřují na `index.php`.

### Zavírání modálů

Modaly s vlastní URL (např. nastavení turnaje) při zavření volají `history.back()` – uživatel se vrátí na nadřazenou obrazovku. Ostatní modaly (alert, confirm) pouze zavřou overlay.

## Neplatné ID

Při otevření URL s neexistujícím turnajem nebo zápasem:
- Zobrazí se chybová hláška na nadřazené obrazovce
- Neexistující turnaj → hlavní obrazovka + hláška
- Neexistující zápas → obrazovka turnaje + hláška
- Neexistující hráč → databáze hráčů + hláška
