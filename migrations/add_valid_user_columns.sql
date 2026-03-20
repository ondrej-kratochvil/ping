-- Migrace: přidání valid_user_from a valid_user_to do všech business tabulek
-- valid_user_from: kdo verzi vytvořil (INSERT)
-- valid_user_to: kdo provedl smazání (DELETE) – NULL = záznam uzavřen editací, ne smazáním

ALTER TABLE matches
    ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_from,
    ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_to;

ALTER TABLE players
    ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_from,
    ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_to;

ALTER TABLE tournaments
    ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_from,
    ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_to;

ALTER TABLE tournament_players
    ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_from,
    ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_to;

ALTER TABLE tournament_teams
    ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_from,
    ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_to;

ALTER TABLE settings
    ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_from,
    ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_to;

-- Views pro čtení aktuálních záznamů (valid_to IS NULL)
CREATE OR REPLACE VIEW current_tournaments AS SELECT * FROM tournaments WHERE valid_to IS NULL;
CREATE OR REPLACE VIEW current_matches AS SELECT * FROM matches WHERE valid_to IS NULL;
CREATE OR REPLACE VIEW current_players AS SELECT * FROM players WHERE valid_to IS NULL;
CREATE OR REPLACE VIEW current_tournament_players AS SELECT * FROM tournament_players WHERE valid_to IS NULL;
CREATE OR REPLACE VIEW current_tournament_teams AS SELECT * FROM tournament_teams WHERE valid_to IS NULL;
CREATE OR REPLACE VIEW current_settings AS SELECT * FROM settings WHERE valid_to IS NULL;
