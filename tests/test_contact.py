import os
import smtplib
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

import app


ENV = {
    "SMTP_HOST": "smtp.example.com",
    "SMTP_PORT": "465",
    "SMTP_USERNAME": "sender@example.com",
    "SMTP_PASSWORD": "secret",
    "SMTP_FROM_EMAIL": "sender@example.com",
    "SMTP_TO_EMAIL": "mkkarthik0609@gmail.com",
}


def request(**overrides):
    values = {
        "name": "Visitor Name",
        "email": "visitor@example.com",
        "message": "Hello Karthik!",
        "website": "",
    }
    values.update(overrides)
    return app.ContactRequest(**values)


class ValidationTests(unittest.TestCase):
    def test_valid_request_is_trimmed(self):
        contact = request(name="  Visitor Name  ")
        self.assertEqual(contact.name, "Visitor Name")

    def test_rejects_bad_email_header_injection_and_extra_fields(self):
        invalid = [
            {"email": "not-an-email"},
            {"name": "Visitor\r\nBcc: victim@example.com"},
            {"message": "short"},
            {"unexpected": "value"},
        ]
        for values in invalid:
            with self.subTest(values=values), self.assertRaises(ValidationError):
                request(**values)

    def test_honeypot_is_rejected_before_smtp(self):
        with patch.object(app, "_send_email") as send:
            with self.assertRaises(HTTPException) as raised:
                app.contact(request(website="https://spam.example"))
        self.assertEqual(raised.exception.status_code, 400)
        send.assert_not_called()


class SmtpTests(unittest.TestCase):
    @patch.dict(os.environ, ENV, clear=True)
    @patch("app.smtplib.SMTP_SSL")
    def test_ssl_submission_waits_for_smtp_acceptance(self, smtp_ssl):
        client = MagicMock()
        client.send_message.return_value = {}
        smtp_ssl.return_value.__enter__.return_value = client

        result = app.contact(request())

        self.assertTrue(result.accepted)
        client.login.assert_called_once_with("sender@example.com", "secret")
        sent = client.send_message.call_args.args[0]
        self.assertEqual(sent["Reply-To"], "visitor@example.com")
        self.assertEqual(sent["Subject"], "Portfolio Contact: Visitor Name")

    @patch.dict(os.environ, {**ENV, "SMTP_PORT": "587"}, clear=True)
    @patch("app.smtplib.SMTP")
    def test_starttls_submission(self, smtp):
        client = MagicMock()
        client.send_message.return_value = {}
        smtp.return_value.__enter__.return_value = client

        app._send_email(request())

        client.starttls.assert_called_once()
        self.assertEqual(client.ehlo.call_count, 2)

    @patch.dict(os.environ, ENV, clear=True)
    @patch("app.smtplib.SMTP_SSL")
    def test_smtp_failure_is_generic(self, smtp_ssl):
        client = MagicMock()
        client.login.side_effect = smtplib.SMTPAuthenticationError(535, b"bad credentials")
        smtp_ssl.return_value.__enter__.return_value = client

        with self.assertRaises(HTTPException) as raised:
            app.contact(request())

        self.assertEqual(raised.exception.status_code, 503)
        self.assertNotIn("credentials", raised.exception.detail.lower())


if __name__ == "__main__":
    unittest.main()
