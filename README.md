# 🏓 Ping Pong Turnajová Aplikace

Aplikace pro správu a sledování ping pong turnajů s podporou více turnajů, statistik a detailního sledování zápasů.

## 📋 Obsah

- [Instalace](#instalace)
- [Konfigurace](#konfigurace)
- [Struktura projektu](#struktura-projektu)
- [Databáze](#databáze)
- [API](#api)
- [Vývoj](#vývoj)

## 🚀 Instalace

### Požadavky

- PHP 7.4 nebo vyšší
- MySQL/MariaDB 5.7 nebo vyšší
- Apache/Nginx web server
- Node.js (pro Cypress testy - volitelné)

### Kroky instalace

1. **Naklonujte repozitář**
   ```bash
   git clone https://github.com/ondrej-kratochvil/ping.git
   cd ping
   ```

2. **Vytvořte databázi**
   - Otevřete phpMyAdmin nebo MySQL klienta
   - Vytvořte novou databázi (např. `sensiocz02`)
   - Importujte soubor `ping3.sql` do databáze

3. **Nastavte konfiguraci**
   - Zkopírujte `.env.example` jako `.env.localhost` pro lokální vývoj
   - Upravte přihlašovací údaje k databázi v `.env.localhost`:
     ```
     DB_HOST=127.0.0.1
     DB_NAME=sensiocz02
     DB_USER=root
     DB_PASS=vertrigo
     DEBUG=true
     ```

4. **Nainstalujte zĂˇvislosti** (pro testy)
   ```bash
   npm install
   ```
   SloĹľka `node_modules` je v `.gitignore` â€“ po klonovĂˇnĂ­ je tĹ™eba spustit `npm install`.

5. **Nastavte web server**
   - Pro WAMP/XAMPP: Umístěte projekt do `www` složky
   - Pro Apache: Nakonfigurujte VirtualHost
   - Otevřete aplikaci v prohlížeči: `http://localhost/a/ping/`

## ⚙️ Konfigurace

### Environment soubory

Aplikace podporuje různé konfigurace pro různé prostředí:

- **`.env.localhost`** - Pro lokální vývoj (automaticky se používá na localhost)
- **`.env.production`** - Pro produkční server
- **`.env.example`** - Šablona pro dokumentaci

Konfigurační soubor `config/config.php` automaticky detekuje prostředí podle `HTTP_HOST` a načte příslušný `.env` soubor.

### Struktura .env souboru

```ini
DB_HOST=127.0.0.1          # Adresa databázového serveru
DB_NAME=sensiocz02          # Název databáze
DB_USER=root                # Uživatel databáze
DB_PASS=vertrigo            # Heslo databáze
DEBUG=true                   # Debug mód (true/false)
```

## 📁 Struktura projektu

```
ping/
├── api.php                  # Backend API endpoint
├── index.php                # Hlavní frontend aplikace
├── style.css                # CSS styly aplikace
├── config/
│   └── config.php          # Konfigurace databáze a prostředí
├── docs/                   # Dokumentace (viz sekce Dokumentace)
├── migrations/             # SQL migrační skripty
├── tests/                  # Testovací soubory
├── js/                     # JavaScript moduly (včetně router.js)
├── cypress/                # Cypress E2E testy
├── data/                   # Data soubory (pokud jsou)
├── .env.localhost          # Lokální konfigurace (NEPŘIDÁVAT DO GIT)
├── .env.production         # Produkční konfigurace (NEPŘIDÁVAT DO GIT)
├── .env.example            # Šablona konfigurace
├── ping3.sql               # SQL skript pro vytvoření databáze
├── package.json            # Node.js závislosti
└── README.md               # Tento soubor
```

## 📚 Dokumentace

Všechna dokumentace je umístěna ve složce `/docs`:

- **[MANUAL_TEST_SUITE.md](docs/MANUAL_TEST_SUITE.md)** - Kompletní sada manuálních testů
- **[TESTING_SOLUTION.md](docs/TESTING_SOLUTION.md)** - Řešení problému s dynamickými `aria-ref` atributy
- **[TESTING_HELPERS.md](docs/TESTING_HELPERS.md)** - Helper funkce pro automatizované testování
- **[TESTING_QUICK_REFERENCE.md](docs/TESTING_QUICK_REFERENCE.md)** - Rychlý referenční průvodce pro testování
- **[TESTING_BROWSER_TOOLS_GUIDE.md](docs/TESTING_BROWSER_TOOLS_GUIDE.md)** - Průvodce používáním Browser nástrojů
- **[MANUAL_TESTING_GUIDE.md](docs/MANUAL_TESTING_GUIDE.md)** - Průvodce rychlým manuálním testováním
- **[MISSING_IMPLEMENTATIONS.md](docs/MISSING_IMPLEMENTATIONS.md)** - Seznam chybějících implementací v UI
- **[TESTING_IMPROVEMENTS.md](docs/TESTING_IMPROVEMENTS.md)** - Detailní návrhy na zlepšení testování
- **[TEST_SWAP_SIDES.md](docs/TEST_SWAP_SIDES.md)** - Dokumentace k funkci prohození stran
- **[ROUTING.md](docs/ROUTING.md)** - Routování a mapování URL
- **[INSTALACE_NODEJS.md](docs/INSTALACE_NODEJS.md)** - Instalační průvodce pro Node.js
- **[REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md)** - Plán refaktoringu
- **[STATUS_IMPLEMENTACE.md](docs/STATUS_IMPLEMENTACE.md)** - Status implementace funkcionalit

## 🗄️ Databáze

### Struktura tabulek

- **`players`** - Hráči (id, entity_id, name, photo_url, strengths, weaknesses, valid_from, valid_to)
- **`tournaments`** - Turnaje (id, entity_id, name, points_to_win, **tournament_type**, is_locked, valid_from, valid_to)
- **`tournament_players`** - Vazba hráčů na turnaje (id, entity_id, tournament_id, player_id, player_order, valid_from, valid_to)
- **`tournament_teams`** - Dvojice pro čtyřhru (id, entity_id, tournament_id, team_order, player1_id, player2_id, valid_from, valid_to)
- **`matches`** - Zápasy (id, entity_id, tournament_id, player1_id, player2_id, **team1_id**, **team2_id**, score1, score2, completed, first_server, serving_player, **double_rotation_state**, sides_swapped, match_order, valid_from, valid_to)
- **`settings`** - Nastavení aplikace (id, entity_id, setting_key, setting_value, valid_from, valid_to)
- **`sync_status`** - Status synchronizace (id, table_name, last_sync)

### Temporal Versioning

Aplikace používá temporal versioning pattern - místo UPDATE se používají INSERT s `valid_to` timestampem. Aktuální záznamy mají `valid_to = NULL`.

### Migrace

Pro přidání nových sloupců nebo změny struktury použijte migrační skripty v SQL formátu.

## 🎮 Funkcionality

### Uživatelské rozhraní

Aplikace má responzivní design optimalizovaný pro mobilní zařízení i desktop:

- **Toast notifikace**: Po úspěšném vytvoření turnaje nebo uložení nastavení se zobrazí mizející upozornění vpravo dole
- **Mobilní optimalizace**: Tlačítka se automaticky přizpůsobí úzkým displejům, aby zůstala viditelná
- **Inteligentní autocomplete**: Při vytváření turnaje se seznam hráčů zobrazí automaticky a zůstane otevřený, dokud není dosaženo minimálního počtu hráčů (2 pro dvouhru, 4 pro čtyřhru)

### Kopírování turnaje

Aplikace umožňuje rychlé kopírování turnaje pro pokračování s novým turnajem:

- **Kde najdete:**
  - V nastavení turnaje (tlačítko "Kopírovat turnaj")
  - Po ukončení turnaje (tlačítko "Kopírovat turnaj" vedle "Zavřít")

- **Co se zkopíruje:**
  - Název turnaje (s automatickým číslem, např. "Turnaj (2)")
  - Všichni hráči turnaje
  - Všechny zápasy (s nulovými skóre)
  - Nastavení počtu bodů k výhře

- **Speciální funkce:**
  - Automatické prohození stran hráčů (hráči, kteří hráli vlevo, budou vpravo a naopak)
  - **Pro čtyřhru:** Při kopírování turnaje čtyřhry se navíc otočí pořadí hráčů v rámci každého týmu, aby se změnilo pořadí podání (např. z A1, B1, A2, B2 na B2, A2, B1, A1)
  - Nový turnaj je připraven k okamžitému spuštění

**Výběr hráčů:**
- Při otevření modalu pro vytvoření turnaje se okamžitě zobrazí seznam dostupných hráčů (maximálně 10)
- Seznam zůstane otevřený po výběru hráče, dokud není dosažen minimální počet hráčů (2 pro dvouhru, 4 pro čtyřhru)
- Po dosažení minimálního počtu se seznam automaticky zavře
- Seznam se znovu otevře při kliknutí do pole pro výběr hráče
- Seznam se automaticky filtruje při psaní jména hráče
- Hráči, kteří už jsou v turnaji, se nezobrazují v seznamu
- Pro výběr hráče klikněte na jeho jméno v seznamu nebo použijte šipky nahoru/dolů a Enter
  - **Inteligentní názvy:** Pokud turnaj obsahuje dnešní datum, použije se stávající logika s číslem. Pokud obsahuje starší datum, použije se dnešní datum v názvu (např. "Turnaj 20. 11. 2025")

### Čtyřhra (doubles)

- **Přepínač formátu:** Při vytváření turnaje zvolíte singl/double. Čtyřhra vyžaduje 4–16 hráčů a sudý počet, UI hlídá limity.
- **Týmy:** Dvojice vznikají podle pořadí hráčů (1+2, 3+4, …) a ukládají se do tabulky `tournament_teams`.
- **Zápasy:** Každý zápas ví, které týmy proti sobě stojí (`team1_id`, `team2_id`). Scoreboard zobrazuje názvy týmů ve formátu „Honza + Petr“.
- **Oficiální podání:** Po výběru počáteční strany se servis střídá A1 → B1 → A2 → B2 (bloky 2 bodů u 11, 5 bodů u 21; po 10:10/20:20 po jednom bodu). Stav rotace se ukládá do `double_rotation_state`.
- **Statistiky:** V detailu turnaje i v celkových statistikách najdete žebříček týmů. Exporty CSV/PDF obsahují názvy týmů a správně vyhodnocují vzájemné duely i ve čtyřhře.

### Vrácení posledního bodu (Undo)

Během hry můžete vrátit poslední přidaný bod:

- **Kde najdete:** Tlačítko "Vrátit poslední bod" v zobrazení vítěze zápasu
- **Kdy je dostupné:** Pouze pokud byl přidán alespoň jeden bod
- **Co se vrátí:** Poslední přidaný bod, stav podávání a stav prvního podávajícího

### Klávesové zkratky

Aplikace podporuje kompletní workflow ovládání pomocí šipek vlevo a vpravo:

#### Během hry
- **Šipka vlevo (←):** Přidá bod levému hráči
- **Šipka vpravo (→):** Přidá bod pravému hráči

#### Po vítězství zápasu
- **Šipka vlevo (←):** Vrátí poslední bod (Undo)
- **Šipka vpravo (→):** Uloží výsledek zápasu

#### V modalu "Kdo má první podání"
- **Šipka vlevo (←):** Vybere levého hráče
- **Šipka vpravo (→):** Vybere pravého hráče

#### V průběžném pořadí
- **Šipka vpravo (→):** Pokračuje v turnaji

#### V konečných výsledcích
- **Šipka vlevo (←):** Zavře modal
- **Šipka vpravo (→):** Kopíruje turnaj

#### V nadcházejících zápasech
- **Šipka vpravo (→):** Spustí první zápas ze seznamu

#### Na hlavní obrazovce
- **Šipka vpravo (→):** Spustí první turnaj s tlačítkem "Start turnaje"

**Poznámka:** Zkratky fungují pouze když není otevřený žádný input field nebo textarea. Všechny zkratky respektují `sidesSwapped` (prohození stran hráčů).

### Automatická kontrola názvů turnajů

Při vytváření nového turnaje aplikace automaticky kontroluje, zda název už neexistuje:
- Pokud název existuje, automaticky se přidá číslo v závorce (např. "Turnaj (2)", "Turnaj (3)")
- Tato logika je stejná jako při kopírování turnaje
- Zajišťuje, že každý turnaj má unikátní název

### Routování (URL)

Aplikace používá History API pro routování – každá obrazovka má vlastní URL, lze odkazovat a obnovit stránku bez ztráty kontextu.

**Mapování URL** (na localhostu s prefixem `/a/ping/`, na produkci v rootu):

| URL | Obrazovka |
|-----|-----------|
| `/` | Hlavní obrazovka (seznam turnajů) |
| `/tournament/new` | Modal nového turnaje |
| `/tournament/123` | Obrazovka turnaje |
| `/tournament/123/settings` | Modal nastavení turnaje |
| `/tournament/123/stats` | Statistiky turnaje |
| `/tournament/123/match/456` | Herní obrazovka |
| `/players` | Databáze hráčů |
| `/players/new` | Modal nového hráče |
| `/players/123` | Modal úpravy hráče |
| `/stats/overall` | Celkové statistiky |

**Technické:**
- `.htaccess` přepisuje neexistující cesty na `index.php`
- Tlačítko Zpět v prohlížeči funguje jako navigace mezi obrazovkami
- Neplatné ID (neexistující turnaj/zápas) zobrazí chybovou hlášku na nadřazené obrazovce

### Konzistentní barvy hráčů

Barvy hráčů jsou konzistentní napříč celou aplikací:
- Každý hráč má přiřazenou barvu podle svého pořadí v turnaji
- Barvy se zachovávají v nadcházejících zápasech, modalu "Kdo má první podání" i během samotného zápasu
- Barvy se určují podle pořadí hráče v seznamu hráčů turnaje

### Export dat

Aplikace umožňuje exportovat statistiky turnaje do různých formátů:

- **Kde najdete:** Tlačítka "Export CSV" a "Export PDF" v obrazovce statistik turnaje

- **CSV export obsahuje:**
  - Informace o turnaji (název, datum vytvoření, body k výhře)
  - Výsledkovou listinu (pozice, jméno, vítězství, porážky, odehráno, úspěšnost)
  - Matici vzájemných zápasů
  - Seznam všech zápasů s výsledky
  - U čtyřhry zobrazuje názvy týmů a správně řeší vzájemné zápasy jednotlivců podle týmů

- **PDF export obsahuje:**
  - Informace o turnaji
  - Výsledkovou listinu (formátovanou tabulku)
  - Matici vzájemných zápasů s barevným rozlišením výher a proher
  - Automatické stránkování pro větší turnaje
  - Správné zobrazení českých znaků

**Technické detaily:**
- CSV export používá UTF-8 s BOM pro správné zobrazení českých znaků
- PDF export používá html2canvas a jsPDF pro renderování HTML do PDF
- Soubory se stahují s názvem obsahujícím název turnaje a datum

### Nastavení aplikace

Aplikace umožňuje přizpůsobit chování pomocí nastavení dostupných v menu (ozubené kolečko v pravém horním rohu):

- **Zvuky** - Zapnutí/vypnutí zvukových efektů při přidávání bodů
- **Hlas** - Zapnutí/vypnutí hlasového asistenta, který hlásí skóre a další informace
- **Motivační hlášky** - Zapnutí/vypnutí náhodných motivačních hlášek během zápasu
- **Zobrazit zamčené turnaje** - Zobrazení/skrytí zamčených turnajů v seznamu turnajů

**Dostupnost nastavení:**
- Všechna nastavení jsou dostupná v hlavním menu aplikace
- Během zápasu jsou dostupná tlačítka pro rychlé zapnutí/vypnutí hlasového asistenta, motivačních hlášek a zvuků

**Uložení nastavení:**
- Všechna nastavení se automaticky ukládají do databáze
- Nastavení jsou trvalá a zachovávají se mezi relacemi

### Hlasový asistent

Hlasový asistent poskytuje hlasové hlášení během zápasu:

- **Hlášení skóre:** Při každém přidání bodu hlásí jméno hráče s podáním a aktuální skóre (např. "Jan, 5 : 3")
- **Konec zápasu:** Po ukončení zápasu hlásí vítěze a finální skóre
- **Motivační hlášky:** Pokud jsou zapnuté, přidává náhodné motivační hlášky vždy při každém bodu. Hlášky jsou inteligentně vybírány podle situace:
  - **Obecné hlášky** - vhodné kdykoliv během zápasu (např. "Pojď, draku!", "To byl úder!", "Paráda!")
  - **Hlášky pro blízký konec** - když jeden hráč potřebuje 1-2 body k vítězství (např. "Ještě jeden!", "Téměř tam!", "Poslední bod!")

**Technické detaily:**
- Používá Web Speech API (SpeechSynthesis)
- Jazyk: čeština (cs-CZ)
- Hlášení se automaticky ruší před novým hlášením, aby se zprávy nekumulovaly

## 🔌 API

### Endpoint

**URL:** `/api.php`

**Metody:**
- `GET` - Načtení všech dat (turnaje, hráči, nastavení)
- `POST` - Provádění akcí

### POST Akce

Všechny POST požadavky musí obsahovat JSON s `action` a `payload`:

```json
{
  "action": "savePlayer",
  "payload": {
    "data": {
      "name": "Jan Novák",
      "photoUrl": "",
      "strengths": "",
      "weaknesses": ""
    }
  }
}
```

#### Dostupné akce:

- `createTournament` - Vytvoření nového turnaje
- `updateTournament` - Aktualizace turnaje
- `updateMatch` - Aktualizace zápasu
- `savePlayer` - Uložení/aktualizace hráče
- `deletePlayer` - Smazání hráče (soft delete)
- `deleteTournament` - Smazání turnaje (soft delete)
- `saveSettings` - Uložení nastavení
- `reorderMatches` - Změna pořadí zápasů
- `swapSides` - Prohození stran hráčů
- `toggleTournamentLock` - Zamknutí/odemknutí turnaje

### Odpověď API

**Úspěšná odpověď:**
```json
{
  "settings": {...},
  "playerDatabase": [...],
  "tournaments": [...]
}
```

**Chybová odpověď:**
```json
{
  "error": "Chybová zpráva"
}
```

## 🧪 Vývoj

### Spuštění testů

```bash
npm install
npm run cypress:open
```

### Debug mód

Nastavte `DEBUG=true` v `.env.localhost` pro zobrazení detailních chybových hlášek.

## 📝 Poznámky

- Aplikace používá temporal versioning - historie změn je zachována
- Všechny `.env` soubory jsou v `.gitignore` - necommitovat citlivé údaje
- Pro produkci změňte `Access-Control-Allow-Origin` v `api.php` na konkrétní doménu

## 📄 Licence

ISC

## 👤 Autor

Ondřej Kratochvíl

