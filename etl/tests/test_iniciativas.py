

def test_curl_text_retries_a_stalled_request(monkeypatch):
    import subprocess
    from types import SimpleNamespace
    from congreso import iniciativas
    calls=[]
    def run(*a,**kw):
        calls.append(1)
        if len(calls)==1: raise subprocess.TimeoutExpired(cmd='curl',timeout=50)
        return SimpleNamespace(returncode=0,stdout='ok',stderr='')
    monkeypatch.setattr(iniciativas.subprocess,'run',run)
    monkeypatch.setattr(iniciativas.time,'sleep',lambda s:None)
    assert iniciativas.curl_text('https://www.congreso.es/x')=='ok'
    assert len(calls)==2


def test_attendance_curl_retries_a_stalled_request(monkeypatch):
    import subprocess
    from types import SimpleNamespace
    from congreso import asistencia
    calls=[]
    def run(*a,**kw):
        calls.append(1)
        if len(calls)==1: raise subprocess.TimeoutExpired(cmd='curl',timeout=30)
        return SimpleNamespace(stdout='ok')
    monkeypatch.setattr(asistencia.subprocess,'run',run)
    monkeypatch.setattr(asistencia.time,'sleep',lambda s:None)
    assert asistencia.curl_text('https://www.congreso.es/x')=='ok'
    assert len(calls)==2
