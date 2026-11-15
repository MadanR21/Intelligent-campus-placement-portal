
import sys
from pathlib import Path
from unittest.mock import patch

import pytest


# Make the backend folder available for imports.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_PATH = PROJECT_ROOT / "backend"

sys.path.insert(0, str(BACKEND_PATH))

import email_service


class FakeSMTP:
    """Fake SMTP server used to test email delivery safely."""

    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.started_tls = False
        self.logged_in = False
        self.sent_message = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def starttls(self):
        self.started_tls = True

    def login(self, username, password):
        self.logged_in = True

    def send_message(self, message):
        self.sent_message = message


def configure_smtp(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "test@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "test-password")
    monkeypatch.setenv("SENDER_EMAIL", "test@example.com")


def test_email_is_not_sent_without_smtp_configuration(monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_USERNAME", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    monkeypatch.delenv("SENDER_EMAIL", raising=False)

    result = email_service.send_email(
        "student@example.com",
        "Test Subject",
        "Test message"
    )

    assert result is False


def test_send_email_uses_smtp_configuration(monkeypatch):
    configure_smtp(monkeypatch)

    fake_server = FakeSMTP("smtp.example.com", 587)

    with patch.object(
        email_service.smtplib,
        "SMTP",
        return_value=fake_server
    ):
        result = email_service.send_email(
            "student@example.com",
            "CampusConnect Test",
            "This is a test notification."
        )

    assert result is True
    assert fake_server.started_tls is True
    assert fake_server.logged_in is True
    assert fake_server.sent_message is not None

    assert fake_server.sent_message["To"] == "student@example.com"
    assert fake_server.sent_message["Subject"] == "CampusConnect Test"


def test_application_status_email_content():
    with patch.object(
        email_service,
        "send_email",
        return_value=True
    ) as mocked_send:

        result = email_service.send_application_status_email(
            student_name="Test Student",
            student_email="student@example.com",
            job_title="Python Developer",
            company_name="Example Company",
            application_status="Shortlisted"
        )

    assert result is True
    mocked_send.assert_called_once()

    arguments = mocked_send.call_args.kwargs

    assert arguments["to_email"] == "student@example.com"
    assert "Example Company" in arguments["subject"]
    assert "Shortlisted" in arguments["body"]
    assert "Python Developer" in arguments["body"]


def test_interview_email_content():
    with patch.object(
        email_service,
        "send_email",
        return_value=True
    ) as mocked_send:

        result = email_service.send_interview_email(
            student_name="Test Student",
            student_email="student@example.com",
            job_title="Software Engineer",
            company_name="Example Company",
            interview_date="2026-12-01 10:00",
            interview_mode="Online",
            meeting_details="https://example.com/meeting"
        )

    assert result is True
    mocked_send.assert_called_once()

    arguments = mocked_send.call_args.kwargs

    assert arguments["to_email"] == "student@example.com"
    assert "Interview Scheduled" in arguments["subject"]
    assert "Software Engineer" in arguments["body"]
    assert "https://example.com/meeting" in arguments["body"]
