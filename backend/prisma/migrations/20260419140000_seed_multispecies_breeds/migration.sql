-- Seed breeds for goat, poultry, and pig (cattle breeds already exist). Codes are globally unique.

INSERT INTO "breeds" ("id", "species_id", "name", "code", "description")
VALUES
  -- Goats (species_id = goat)
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111102', 'Saanen', 'SAANEN_GOAT', 'Saanen dairy goat'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111102', 'Boer', 'BOER_GOAT', 'Boer meat goat'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111102', 'Alpine', 'ALPINE_GOAT', 'Alpine dairy goat'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111102', 'Local / indigenous', 'LOCAL_GOAT', 'Local or indigenous goat'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111102', 'Crossbreed', 'CROSS_GOAT', 'Crossbreed / mixed'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111102', 'Other', 'OTHER_GOAT', 'Other / unspecified'),

  -- Poultry
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111103', 'Broiler', 'POULTRY_BROILER', 'Broiler chicken'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111103', 'Layer', 'POULTRY_LAYER', 'Egg-laying hens'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111103', 'Dual-purpose', 'POULTRY_DUAL', 'Dual-purpose birds'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111103', 'Indigenous / local', 'POULTRY_INDIGENOUS', 'Local chicken'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111103', 'Turkey', 'POULTRY_TURKEY', 'Turkey'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111103', 'Other', 'OTHER_POULTRY', 'Other / unspecified'),

  -- Pigs
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111104', 'Large White', 'PIG_LARGE_WHITE', 'Large White'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111104', 'Landrace', 'PIG_LANDRACE', 'Landrace'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111104', 'Hampshire', 'PIG_HAMPSHIRE', 'Hampshire'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111104', 'Local / indigenous', 'PIG_LOCAL', 'Local pig'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111104', 'Crossbreed', 'PIG_CROSS', 'Crossbreed / mixed'),
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111104', 'Other', 'OTHER_PIG', 'Other / unspecified');
