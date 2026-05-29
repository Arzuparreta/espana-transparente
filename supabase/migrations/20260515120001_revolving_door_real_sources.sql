-- Enriquece los 20 casos publicados con fuentes públicas reales.
-- Sustituye la URL genérica de Wikipedia por la fuente primaria verificada
-- (BORME, nota de prensa, hemeroteca de diario de referencia).

-- 1. Inserta las fuentes en revolving_door_sources (arquitectura correcta).
-- Some environments are rebuilt from migrations only; in those databases the
-- manually curated revolving_door rows may not exist yet. Keep the migration
-- idempotent by inserting sources only for cases already present.
WITH source_rows (revolving_door_id, source_type, source_name, source_url, title) AS (
VALUES
  -- Ángel Acebes → Iberdrola (BORME 2012, nombramiento por cooptación)
  ('e2ee603e-8a3f-4f27-a729-705d3f98c77e', 'primary', 'BORME',
   'https://www.boe.es/buscar/doc.php?id=BORME-C-2012-11821',
   'BORME-C-2012-11821 Iberdrola S.A. — nombramiento de consejero'),

  -- Ángel Acebes → Bankia (julio 2011)
  ('f7552018-9c6a-4330-98ae-bd5ef1c6f8f6', 'primary', 'Vozpópuli',
   'https://www.vozpopuli.com/espana/Angel_Acebes-Bankia-Rodrigo_Rato_0_551944852.html',
   'Ángel Acebes cobró 163.000€ en cinco meses en Bankia'),

  -- Elena Salgado → Chilectra / Endesa Chile (marzo 2012)
  ('6247135d-a676-4ed8-abfe-cc6d6d301fc4', 'primary', 'El Economista',
   'https://www.eleconomista.es/empresas-finanzas/noticias/3795537/03/12/Endesa-contrata-a-Elena-Salgado-como-consejera-de-su-filial-chilena.html',
   'Endesa contrata a Elena Salgado como consejera de su filial chilena'),

  -- Felipe González → Gas Natural Fenosa (diciembre 2010)
  ('4c7712ac-8ef3-455e-b72c-c7532e9df9ae', 'primary', 'El Economista',
   'https://www.eleconomista.es/empresas-finanzas/noticias/2684263/12/10/El-ex-presidente-Gonzalez-asesora-a-Gas-Natural-sobre-Argelia.html',
   'El ex presidente Felipe González entra en consejo de Gas Natural'),

  -- Isabel Tocino → Banco Santander (BORME 2010)
  ('b6de3c41-4e3e-4962-985b-e5702e3e7512', 'primary', 'BORME',
   'https://www.boe.es/buscar/doc.php?id=BORME-C-2010-11348',
   'BORME-C-2010-11348 Banco Santander S.A. — nombramiento de consejera'),

  -- Jordi Sevilla → PricewaterhouseCoopers (septiembre 2009)
  ('64c25345-0530-4e0b-999a-3788fcbecbdd', 'primary', 'Computing.es',
   'https://www.computing.es/noticias/jordi-sevilla-da-el-salto-a-la-iniciativa-privada-y-ficha-por-pricewaterhousecoopers/',
   'Jordi Sevilla da el salto a la iniciativa privada y ficha por PricewaterhouseCoopers'),

  -- José María Aznar → News Corporation (2006, filing SEC + confirmación prensa)
  ('b9c513ed-c52b-410a-a920-95591fa8ce9b', 'primary', 'El Diario',
   'https://www.eldiario.es/economia/News-Corp-propone-consejero-Aznar_0_693630834.html',
   'El grupo de Rupert Murdoch propone renovar como consejero a Aznar'),

  -- José María Aznar → Endesa (enero 2011)
  ('43d7c015-7bbe-48b8-bb2b-58f53f6289fc', 'primary', 'El Economista',
   'https://www.eleconomista.es/flash/noticias/2732042/01/11/Aznar-sera-consejero-en-Endesa-cobrara-200000-euros-medios.html',
   'Aznar será asesor de Endesa: cobrará 200.000 euros al año'),

  -- José María Michavila → Noatum (JP Morgan) (mayo 2011)
  ('bd6a5d83-3827-4fa3-a5c6-5397dc12e840', 'primary', 'Libre Mercado',
   'https://www.libertaddigital.com/libremercado/2011-05-13/jose-maria-michavila-ficha-por-jp-morgan-1276423317/',
   'José María Michavila ficha por JP Morgan'),

  -- Josep Borrell → Abengoa (2009)
  ('7b5b94d5-396f-4f27-9010-57bc3da83960', 'primary', 'Público',
   'https://www.publico.es/economia/consejero-abengoa-cnmv-sanciono-ministro-borrell-informacion-privilegiada.html',
   'Era consejero de Abengoa: La CNMV sancionó a Borrell por vender acciones con información privilegiada'),

  -- Josep Piqué → Vueling (noviembre 2007)
  ('16864337-d678-49be-8a5a-25f592835936', 'primary', 'Público',
   'https://www.publico.es/actualidad/josep-pique-nombrado-nuevo-presidente-aerolinea-vueling.html',
   'Josep Piqué nombrado nuevo presidente de la aerolínea Vueling'),

  -- Luis Atienza → Red Eléctrica de España (julio 2004)
  ('4185aab0-36f2-47bb-b233-b445676f36be', 'primary', 'Libre Mercado',
   'https://www.libertaddigital.com/economia/el-gobierno-consigue-colocar-al-ex-ministro-socialista-luis-atienza-como-presidente-de-ree-1276226259/',
   'El Gobierno coloca al ex ministro socialista Luis Atienza como presidente de REE'),

  -- Luis de Guindos → Endesa (consejero independiente hasta 2012)
  ('6df5a057-c030-4425-97f9-a8235dcf93a1', 'primary', 'La Marea',
   'https://www.lamarea.com/2016/07/14/guindos-se-vuelve-abstener-una-orden-electricas-vinculo-endesa/',
   'De Guindos se abstiene en orden sobre eléctricas por su vínculo con Endesa'),

  -- Luis de Guindos → PricewaterhouseCoopers (2008)
  ('9ddfbb8e-37f3-42ae-aaf7-f51e67d579de', 'primary', 'Banco Central Europeo',
   'https://www.ecb.europa.eu/ecb/decisions/html/cvde_guindos.es.html',
   'Currículum Vitae Luis de Guindos — Banco Central Europeo'),

  -- Manuel Pizarro → Endesa (presidente 2002-2007)
  ('10d0986e-c307-4bb3-aaf4-5343f221b56d', 'primary', 'Público',
   'https://publico.es/economia/puertas-giratorias-cuarenta-altos-cargos-gobiernos-pp-psoe-han-colocado-grandes-empresas-privatizadas.html',
   'Puertas giratorias: cuarenta altos cargos de PP y PSOE colocados en grandes empresas'),

  -- Miguel Boyer → Banco Exterior de España (presidente 1985-1988)
  ('e0b901ff-125e-4cb3-8d66-4c48573751af', 'primary', 'Fundación Pablo Iglesias',
   'https://fpabloiglesias.es/entrada-db/boyer-salvador-miguel/',
   'Miguel Boyer Salvador — Fundación Pablo Iglesias (biografía)'),

  -- Narcís Serra → Gas Natural (2009)
  ('1d3af318-3139-46dc-a55b-464821df3a4f', 'primary', 'Diariocrítico',
   'https://www.diariocritico.com/noticia/73196/noticias/narcis-serra-se-incorpora-al-consejo-de-administracion-de-gas-natural.html',
   'Narcís Serra se incorpora al consejo de administración de Gas Natural'),

  -- Narcís Serra → Caixa Catalunya (presidente desde 2005)
  ('59b5a922-9335-49f6-9d92-79eee2389fd8', 'primary', 'Libre Mercado',
   'https://www.libertaddigital.com/economia/narcis-serra-sera-el-nuevo-presidente-de-caixa-cataluna-a-partir-de-marzo-1276244662/',
   'Narcís Serra será el nuevo presidente de Caixa Cataluña'),

  -- Rodrigo Rato → Telefónica (enero 2013)
  ('1fe28877-aba0-4588-895c-6a0c3a0b9468', 'primary', 'Público',
   'https://www.publico.es/actualidad/telefonica-incorpora-rodrigo-rato-consejero.html',
   'Telefónica incorpora a Rodrigo Rato como consejero para Latinoamérica y Europa'),

  -- Rodrigo Rato → Bankia (presidente desde enero 2010)
  ('8b0727c8-bad9-4057-a26a-593657f714f7', 'primary', 'Newtral',
   'https://www.newtral.es/quien-es-rodrigo-rato/20230530/',
   '¿Quién es Rodrigo Rato? De vicepresidente del Gobierno a dos años preso en Soto del Real')
)
INSERT INTO revolving_door_sources (revolving_door_id, source_type, source_name, source_url, title)
SELECT s.revolving_door_id::uuid, s.source_type, s.source_name, s.source_url, s.title
FROM source_rows s
JOIN revolving_door rd ON rd.id = s.revolving_door_id::uuid
ON CONFLICT DO NOTHING;

-- 2. Actualiza source_url en revolving_door para que el fallback sea correcto
UPDATE revolving_door SET source_url = 'https://www.boe.es/buscar/doc.php?id=BORME-C-2012-11821'
  WHERE id = 'e2ee603e-8a3f-4f27-a729-705d3f98c77e';
UPDATE revolving_door SET source_url = 'https://www.vozpopuli.com/espana/Angel_Acebes-Bankia-Rodrigo_Rato_0_551944852.html'
  WHERE id = 'f7552018-9c6a-4330-98ae-bd5ef1c6f8f6';
UPDATE revolving_door SET source_url = 'https://www.eleconomista.es/empresas-finanzas/noticias/3795537/03/12/Endesa-contrata-a-Elena-Salgado-como-consejera-de-su-filial-chilena.html'
  WHERE id = '6247135d-a676-4ed8-abfe-cc6d6d301fc4';
UPDATE revolving_door SET source_url = 'https://www.eleconomista.es/empresas-finanzas/noticias/2684263/12/10/El-ex-presidente-Gonzalez-asesora-a-Gas-Natural-sobre-Argelia.html'
  WHERE id = '4c7712ac-8ef3-455e-b72c-c7532e9df9ae';
UPDATE revolving_door SET source_url = 'https://www.boe.es/buscar/doc.php?id=BORME-C-2010-11348'
  WHERE id = 'b6de3c41-4e3e-4962-985b-e5702e3e7512';
UPDATE revolving_door SET source_url = 'https://www.computing.es/noticias/jordi-sevilla-da-el-salto-a-la-iniciativa-privada-y-ficha-por-pricewaterhousecoopers/'
  WHERE id = '64c25345-0530-4e0b-999a-3788fcbecbdd';
UPDATE revolving_door SET source_url = 'https://www.eldiario.es/economia/News-Corp-propone-consejero-Aznar_0_693630834.html'
  WHERE id = 'b9c513ed-c52b-410a-a920-95591fa8ce9b';
UPDATE revolving_door SET source_url = 'https://www.eleconomista.es/flash/noticias/2732042/01/11/Aznar-sera-consejero-en-Endesa-cobrara-200000-euros-medios.html'
  WHERE id = '43d7c015-7bbe-48b8-bb2b-58f53f6289fc';
UPDATE revolving_door SET source_url = 'https://www.libertaddigital.com/libremercado/2011-05-13/jose-maria-michavila-ficha-por-jp-morgan-1276423317/'
  WHERE id = 'bd6a5d83-3827-4fa3-a5c6-5397dc12e840';
UPDATE revolving_door SET source_url = 'https://www.publico.es/economia/consejero-abengoa-cnmv-sanciono-ministro-borrell-informacion-privilegiada.html'
  WHERE id = '7b5b94d5-396f-4f27-9010-57bc3da83960';
UPDATE revolving_door SET source_url = 'https://www.publico.es/actualidad/josep-pique-nombrado-nuevo-presidente-aerolinea-vueling.html'
  WHERE id = '16864337-d678-49be-8a5a-25f592835936';
UPDATE revolving_door SET source_url = 'https://www.libertaddigital.com/economia/el-gobierno-consigue-colocar-al-ex-ministro-socialista-luis-atienza-como-presidente-de-ree-1276226259/'
  WHERE id = '4185aab0-36f2-47bb-b233-b445676f36be';
UPDATE revolving_door SET source_url = 'https://www.lamarea.com/2016/07/14/guindos-se-vuelve-abstener-una-orden-electricas-vinculo-endesa/'
  WHERE id = '6df5a057-c030-4425-97f9-a8235dcf93a1';
UPDATE revolving_door SET source_url = 'https://www.ecb.europa.eu/ecb/decisions/html/cvde_guindos.es.html'
  WHERE id = '9ddfbb8e-37f3-42ae-aaf7-f51e67d579de';
UPDATE revolving_door SET source_url = 'https://publico.es/economia/puertas-giratorias-cuarenta-altos-cargos-gobiernos-pp-psoe-han-colocado-grandes-empresas-privatizadas.html'
  WHERE id = '10d0986e-c307-4bb3-aaf4-5343f221b56d';
UPDATE revolving_door SET source_url = 'https://fpabloiglesias.es/entrada-db/boyer-salvador-miguel/'
  WHERE id = 'e0b901ff-125e-4cb3-8d66-4c48573751af';
UPDATE revolving_door SET source_url = 'https://www.diariocritico.com/noticia/73196/noticias/narcis-serra-se-incorpora-al-consejo-de-administracion-de-gas-natural.html'
  WHERE id = '1d3af318-3139-46dc-a55b-464821df3a4f';
UPDATE revolving_door SET source_url = 'https://www.libertaddigital.com/economia/narcis-serra-sera-el-nuevo-presidente-de-caixa-cataluna-a-partir-de-marzo-1276244662/'
  WHERE id = '59b5a922-9335-49f6-9d92-79eee2389fd8';
UPDATE revolving_door SET source_url = 'https://www.publico.es/actualidad/telefonica-incorpora-rodrigo-rato-consejero.html'
  WHERE id = '1fe28877-aba0-4588-895c-6a0c3a0b9468';
UPDATE revolving_door SET source_url = 'https://www.newtral.es/quien-es-rodrigo-rato/20230530/'
  WHERE id = '8b0727c8-bad9-4057-a26a-593657f714f7';
