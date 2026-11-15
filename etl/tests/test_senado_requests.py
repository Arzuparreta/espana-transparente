import subprocess
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from src.senado import payload
from src.senado import votaciones as votes

URL = votes.BASE + '/legis15/votaciones/ses_24.xml'
DENIED = b'<html><title>Access Denied</title></html>'


@pytest.fixture
def sleeps(monkeypatch):
    sleep = Mock()
    monkeypatch.setattr(votes.time, 'sleep', sleep)
    return sleep


def test_text_retries_a_transient_denial_on_the_same_url(monkeypatch, sleeps):
    request = Mock(side_effect=[SimpleNamespace(stdout=DENIED), SimpleNamespace(stdout=b'<main/>')])
    monkeypatch.setattr(votes.subprocess, 'run', request)
    assert votes.curl_text(URL, delay=0) == '<main/>'
    assert request.call_count == 2
    assert all(call.args[0][-1] == URL for call in request.call_args_list)
    sleeps.assert_called_once_with(5)


def test_text_still_fails_after_three_denials(monkeypatch, sleeps):
    request = Mock(return_value=SimpleNamespace(stdout=DENIED))
    monkeypatch.setattr(votes.subprocess, 'run', request)
    with pytest.raises(RuntimeError, match='Access Denied'):
        votes.curl_text(URL, delay=0)
    assert request.call_count == 3
    assert [call.args[0] for call in sleeps.call_args_list] == [5, 10]


@pytest.mark.parametrize('error', [subprocess.TimeoutExpired('curl', 60),
                                subprocess.CalledProcessError(28, 'curl')])
def test_text_retries_transport_failures_but_never_returns_partial_stdout(monkeypatch, sleeps, error):
    request = Mock(side_effect=[error, SimpleNamespace(stdout=b'<main/>')])
    monkeypatch.setattr(votes.subprocess, 'run', request)
    assert votes.curl_text(URL, delay=0) == '<main/>'
    assert request.call_count == 2
    assert request.call_args.kwargs['check'] is True


@pytest.mark.parametrize('transient', [403, 429, 503, 0])
def test_probe_retries_transient_errors_before_classifying_the_source(monkeypatch, sleeps, transient):
    request = Mock(side_effect=[SimpleNamespace(stdout=str(transient)), SimpleNamespace(stdout='200')])
    monkeypatch.setattr(votes.subprocess, 'run', request)
    assert votes.curl_status(URL, delay=0) == 200
    assert request.call_count == 2
    sleeps.assert_called_once_with(5)


@pytest.mark.parametrize('status,attempts', [(403, 3), (404, 1), (200, 1)])
def test_probe_never_reclassifies_a_persistent_block_as_missing(monkeypatch, sleeps, status, attempts):
    request = Mock(return_value=SimpleNamespace(stdout=str(status)))
    monkeypatch.setattr(votes.subprocess, 'run', request)
    assert votes.curl_status(URL, delay=0) == status
    assert request.call_count == attempts


def test_export_keeps_previous_files_when_one_request_is_temporarily_blocked(tmp_path, monkeypatch, sleeps):
    urls = [votes.BASE + f'/legis15/votaciones/ses_{n}.xml' for n in (24, 25)]
    monkeypatch.setattr(votes, 'discover_session_vote_urls', lambda: urls)
    requested = []
    def request(command, **kwargs):
        url = command[-1]
        requested.append(url)
        if url == urls[1] and requested.count(url) == 1:
            return SimpleNamespace(stdout=DENIED)
        number = votes._session_number(url)
        xml = (f'<main><sesion><num_sesion>{number}</num_sesion>'
               '<fecha_sesion>20/10/2026</fecha_sesion></sesion></main>')
        return SimpleNamespace(stdout=xml.encode())
    monkeypatch.setattr(votes.subprocess, 'run', request)
    payload.export_payload(tmp_path)
    assert requested == [urls[0], urls[1], urls[1]]
    assert list(payload.load_payload(tmp_path)) == urls
