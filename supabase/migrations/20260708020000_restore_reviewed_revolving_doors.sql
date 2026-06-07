-- Restore the reviewed revolving-door dataset in databases bootstrapped only
-- from migrations. These are the same 20 records and public sources previously
-- published by the application; stable IDs keep the restore idempotent.

WITH reviewed (
  id, person_name, political_party, public_role, public_organization,
  private_role, private_organization, sector, source_url, source_name, source_title
) AS (
  VALUES
    ('f7552018-9c6a-4330-98ae-bd5ef1c6f8f6'::uuid, 'Ángel Acebes', 'PP', 'Ministro de Administraciones Públicas', 'Gobierno de España', 'Vocal del Consejo', 'Bankia', 'Banca', 'https://www.vozpopuli.com/espana/Angel_Acebes-Bankia-Rodrigo_Rato_0_551944852.html', 'Vozpópuli', 'Ángel Acebes cobró 163.000€ en cinco meses en Bankia'),
    ('e2ee603e-8a3f-4f27-a729-705d3f98c77e'::uuid, 'Ángel Acebes', 'PP', 'Ministro de Administraciones Públicas', 'Gobierno de España', 'Consejero', 'Iberdrola', 'Energía', 'https://www.boe.es/buscar/doc.php?id=BORME-C-2012-11821', 'BORME', 'BORME-C-2012-11821 Iberdrola S.A. — nombramiento de consejero'),
    ('6247135d-a676-4ed8-abfe-cc6d6d301fc4'::uuid, 'Elena Salgado', 'PSOE', 'Ministra de Economía', 'Gobierno de España', 'Consejera', 'Chilectra (Endesa)', 'Energía', 'https://www.eleconomista.es/empresas-finanzas/noticias/3795537/03/12/Endesa-contrata-a-Elena-Salgado-como-consejera-de-su-filial-chilena.html', 'El Economista', 'Endesa contrata a Elena Salgado como consejera de su filial chilena'),
    ('4c7712ac-8ef3-455e-b72c-c7532e9df9ae'::uuid, 'Felipe González', 'PSOE', 'Presidente del Gobierno', 'Gobierno de España', 'Consejero', 'Gas Natural', 'Energía', 'https://www.eleconomista.es/empresas-finanzas/noticias/2684263/12/10/El-ex-presidente-Gonzalez-asesora-a-Gas-Natural-sobre-Argelia.html', 'El Economista', 'El ex presidente Felipe González entra en consejo de Gas Natural'),
    ('b6de3c41-4e3e-4962-985b-e5702e3e7512'::uuid, 'Isabel Tocino', 'PP', 'Ministra de Medio Ambiente', 'Gobierno de España', 'Consejera', 'Banco Santander', 'Banca', 'https://www.boe.es/buscar/doc.php?id=BORME-C-2010-11348', 'BORME', 'BORME-C-2010-11348 Banco Santander S.A. — nombramiento de consejera'),
    ('64c25345-0530-4e0b-999a-3788fcbecbdd'::uuid, 'Jordi Sevilla', 'PSOE', 'Ministro de Administraciones Públicas', 'Gobierno de España', 'Consejero', 'PricewaterhouseCoopers', 'Consultoría', 'https://www.computing.es/noticias/jordi-sevilla-da-el-salto-a-la-iniciativa-privada-y-ficha-por-pricewaterhousecoopers/', 'Computing.es', 'Jordi Sevilla da el salto a la iniciativa privada y ficha por PricewaterhouseCoopers'),
    ('b9c513ed-c52b-410a-a920-95591fa8ce9b'::uuid, 'José María Aznar', 'PP', 'Presidente del Gobierno', 'Gobierno de España', 'Consejero', 'News Corporation', 'Medios', 'https://www.eldiario.es/economia/News-Corp-propone-consejero-Aznar_0_693630834.html', 'El Diario', 'El grupo de Rupert Murdoch propone renovar como consejero a Aznar'),
    ('43d7c015-7bbe-48b8-bb2b-58f53f6289fc'::uuid, 'José María Aznar', 'PP', 'Presidente del Gobierno', 'Gobierno de España', 'Consejero', 'Endesa', 'Energía', 'https://www.eleconomista.es/flash/noticias/2732042/01/11/Aznar-sera-consejero-en-Endesa-cobrara-200000-euros-medios.html', 'El Economista', 'Aznar será asesor de Endesa: cobrará 200.000 euros al año'),
    ('bd6a5d83-3827-4fa3-a5c6-5397dc12e840'::uuid, 'José María Michavila', 'PP', 'Ministro de Justicia', 'Gobierno de España', 'Consejero', 'Noatum (JP Morgan)', 'Banca', 'https://www.libertaddigital.com/libremercado/2011-05-13/jose-maria-michavila-ficha-por-jp-morgan-1276423317/', 'Libre Mercado', 'José María Michavila ficha por JP Morgan'),
    ('7b5b94d5-396f-4f27-9010-57bc3da83960'::uuid, 'Josep Borrell', 'PSOE', 'Ministro de Obras Públicas', 'Gobierno de España', 'Consejero', 'Abengoa', 'Energía', 'https://www.publico.es/economia/consejero-abengoa-cnmv-sanciono-ministro-borrell-informacion-privilegiada.html', 'Público', 'Era consejero de Abengoa: La CNMV sancionó a Borrell por vender acciones con información privilegiada'),
    ('16864337-d678-49be-8a5a-25f592835936'::uuid, 'Josep Piqué', 'PP', 'Ministro de Industria', 'Gobierno de España', 'Presidente', 'Vueling', 'Aviación', 'https://www.publico.es/actualidad/josep-pique-nombrado-nuevo-presidente-aerolinea-vueling.html', 'Público', 'Josep Piqué nombrado nuevo presidente de la aerolínea Vueling'),
    ('4185aab0-36f2-47bb-b233-b445676f36be'::uuid, 'Luis Atienza', 'PSOE', 'Ministro de Agricultura', 'Gobierno de España', 'Presidente', 'Red Eléctrica de España', 'Energía', 'https://www.libertaddigital.com/economia/el-gobierno-consigue-colocar-al-ex-ministro-socialista-luis-atienza-como-presidente-de-ree-1276226259/', 'Libre Mercado', 'El Gobierno coloca al ex ministro socialista Luis Atienza como presidente de REE'),
    ('6df5a057-c030-4425-97f9-a8235dcf93a1'::uuid, 'Luis de Guindos', 'PP', 'Ministro de Economía', 'Gobierno de España', 'Consejero', 'Endesa', 'Energía', 'https://www.lamarea.com/2016/07/14/guindos-se-vuelve-abstener-una-orden-electricas-vinculo-endesa/', 'La Marea', 'De Guindos se abstiene en orden sobre eléctricas por su vínculo con Endesa'),
    ('9ddfbb8e-37f3-42ae-aaf7-f51e67d579de'::uuid, 'Luis de Guindos', 'PP', 'Ministro de Economía', 'Gobierno de España', 'Consejero', 'PricewaterhouseCoopers', 'Consultoría', 'https://www.ecb.europa.eu/ecb/decisions/html/cvde_guindos.es.html', 'Banco Central Europeo', 'Currículum Vitae Luis de Guindos — Banco Central Europeo'),
    ('10d0986e-c307-4bb3-aaf4-5343f221b56d'::uuid, 'Manuel Pizarro', 'PP', 'Diputado', 'Congreso de los Diputados', 'Consejero', 'Endesa', 'Energía', 'https://publico.es/economia/puertas-giratorias-cuarenta-altos-cargos-gobiernos-pp-psoe-han-colocado-grandes-empresas-privatizadas.html', 'Público', 'Puertas giratorias: cuarenta altos cargos de PP y PSOE colocados en grandes empresas'),
    ('e0b901ff-125e-4cb3-8d66-4c48573751af'::uuid, 'Miguel Boyer', 'PSOE', 'Ministro de Economía', 'Gobierno de España', 'Presidente', 'Banco Exterior', 'Banca', 'https://fpabloiglesias.es/entrada-db/boyer-salvador-miguel/', 'Fundación Pablo Iglesias', 'Miguel Boyer Salvador — Fundación Pablo Iglesias (biografía)'),
    ('59b5a922-9335-49f6-9d92-79eee2389fd8'::uuid, 'Narcís Serra', 'PSOE', 'Vicepresidente del Gobierno', 'Gobierno de España', 'Presidente', 'Caixa Catalunya', 'Banca', 'https://www.libertaddigital.com/economia/narcis-serra-sera-el-nuevo-presidente-de-caixa-cataluna-a-partir-de-marzo-1276244662/', 'Libre Mercado', 'Narcís Serra será el nuevo presidente de Caixa Cataluña'),
    ('1d3af318-3139-46dc-a55b-464821df3a4f'::uuid, 'Narcís Serra', 'PSOE', 'Vicepresidente del Gobierno', 'Gobierno de España', 'Consejero', 'Gas Natural', 'Energía', 'https://www.diariocritico.com/noticia/73196/noticias/narcis-serra-se-incorpora-al-consejo-de-administracion-de-gas-natural.html', 'Diariocrítico', 'Narcís Serra se incorpora al consejo de administración de Gas Natural'),
    ('8b0727c8-bad9-4057-a26a-593657f714f7'::uuid, 'Rodrigo Rato', 'PP', 'Ministro de Economía', 'Gobierno de España', 'Presidente', 'Bankia', 'Banca', 'https://www.newtral.es/quien-es-rodrigo-rato/20230530/', 'Newtral', '¿Quién es Rodrigo Rato? De vicepresidente del Gobierno a dos años preso en Soto del Real'),
    ('1fe28877-aba0-4588-895c-6a0c3a0b9468'::uuid, 'Rodrigo Rato', 'PP', 'Ministro de Economía', 'Gobierno de España', 'Consejero', 'Telefónica', 'Telecomunicaciones', 'https://www.publico.es/actualidad/telefonica-incorpora-rodrigo-rato-consejero.html', 'Público', 'Telefónica incorpora a Rodrigo Rato como consejero para Latinoamérica y Europa')
),
restored AS (
  INSERT INTO revolving_door (
    id, person_name, political_party, public_role, public_organization,
    private_role, private_organization, sector, source_url, primary_source_url,
    verification_status, verification_method, verified_at, raw_data
  )
  SELECT
    id, person_name, political_party, public_role, public_organization,
    private_role, private_organization, sector, source_url, source_url,
    'verified', 'reviewed_public_source_restore', now(),
    jsonb_build_object('restored_from', 'reviewed production dataset')
  FROM reviewed
  ON CONFLICT (id) DO UPDATE SET
    person_name = EXCLUDED.person_name,
    political_party = EXCLUDED.political_party,
    public_role = EXCLUDED.public_role,
    public_organization = EXCLUDED.public_organization,
    private_role = EXCLUDED.private_role,
    private_organization = EXCLUDED.private_organization,
    sector = EXCLUDED.sector,
    source_url = EXCLUDED.source_url,
    primary_source_url = EXCLUDED.primary_source_url,
    verification_status = 'verified',
    verification_method = EXCLUDED.verification_method
  RETURNING id
)
INSERT INTO revolving_door_sources (
  revolving_door_id, source_type, source_name, source_url, title
)
SELECT r.id, 'primary', r.source_name, r.source_url, r.source_title
FROM reviewed r
JOIN restored restored_row ON restored_row.id = r.id
ON CONFLICT DO NOTHING;
