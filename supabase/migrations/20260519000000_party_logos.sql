-- Populate logo_url for parties currently in the DB.
-- Sources: Wikimedia Commons (SVG, public domain / CC0 text logos).

UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Logo_del_PP_%282022%29.svg'       WHERE acronym = 'PP';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/4/41/Logotipo_del_PSOE.svg'            WHERE acronym = 'PSOE';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/a/aa/VOX_logo.svg'                     WHERE acronym = 'VOX';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/5/51/Sumar_logo.svg'                   WHERE acronym = 'SUMAR';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/b/bd/ERC_logo_2017.svg'                WHERE acronym = 'ERC';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Logo_coalici%C3%B3n_Junts_generales_2023.svg' WHERE acronym = 'JUNTS';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Logo_de_EH_Bildu_%282023%29.svg' WHERE acronym = 'EH Bildu';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/3/31/Logo_PNV_2025.svg'                WHERE acronym = 'EAJ-PNV';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_UPN_2017.svg'                WHERE acronym = 'UPN';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Coalici%C3%B3n_Canaria.svg'      WHERE acronym = 'CCa';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/a/a9/BNG_logo.svg'                     WHERE acronym = 'BNG';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Logo_de_Podemos_%282022%29.svg'  WHERE acronym = 'Podemos';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Logo_de_Ciudadanos_%282023%29.svg' WHERE acronym = 'Ciudadanos';
UPDATE parties SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/1/18/Logotipo_del_PRC_%282025%29.svg' WHERE acronym = 'PRC';
