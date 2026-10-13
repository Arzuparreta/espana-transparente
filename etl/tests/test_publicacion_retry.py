def test_fiche_retries_generic_search_page(monkeypatch):
    from congreso import publicacion
    pages=iter([b'<html>generic</html>',b'<html>detail</html>'])
    monkeypatch.setattr(publicacion,'fetch_bytes',lambda url,limit=0:next(pages))
    def fiche(html,number):
        if 'generic' in html:raise ValueError('Bill fiche identity mismatch')
        return ['doc']
    monkeypatch.setattr(publicacion,'fiche',fiche)
    assert publicacion.fetch_fiche('u','121/000001',sleep=lambda s:None)==('<html>detail</html>',['doc'])


def test_fiche_does_not_retry_other_evidence_errors(monkeypatch):
    import pytest
    from congreso import publicacion
    calls=[]
    monkeypatch.setattr(publicacion,'fetch_bytes',lambda url,limit=0:calls.append(1) or b'x')
    monkeypatch.setattr(publicacion,'fiche',lambda html,number:(_ for _ in ()).throw(ValueError('Untrusted publication PDF')))
    with pytest.raises(ValueError,match='Untrusted'):publicacion.fetch_fiche('u','n',sleep=lambda s:None)
    assert len(calls)==1
