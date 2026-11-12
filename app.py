import logging
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from typing import Annotated

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator


logger = logging.getLogger(__name__)
EMAIL_PATTERN = re.compile(
    r"^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?"
    r"(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$",
    re.IGNORECASE,
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
Email = Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=254)]
Message = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=5000)]
Honeypot = Annotated[str, StringConstraints(max_length=200)]


def _valid_email(value: str) -> bool:
    return "\r" not in value and "\n" not in value and EMAIL_PATTERN.fullmatch(value) is not None


class ContactRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    email: Email
    message: Message
    website: Honeypot = ""

    @field_validator("name")
    @classmethod
    def reject_header_injection(cls, value: str) -> str:
        if "\r" in value or "\n" in value or "\x00" in value:
            raise ValueError("name contains invalid characters")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not _valid_email(value):
            raise ValueError("email is invalid")
        return value

    @field_validator("message")
    @classmethod
    def reject_null_bytes(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("message contains invalid characters")
        return value


class ContactResponse(BaseModel):
    accepted: bool


class MailDeliveryError(Exception):
    pass


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise MailDeliveryError("missing SMTP configuration")
    return value


def _send_email(contact: ContactRequest) -> None:
    host = _required_env("SMTP_HOST")
    username = _required_env("SMTP_USERNAME")
    password = _required_env("SMTP_PASSWORD")
    from_email = _required_env("SMTP_FROM_EMAIL")
    to_email = os.environ.get("SMTP_TO_EMAIL", "mkkarthik0609@gmail.com").strip()

    try:
        port = int(_required_env("SMTP_PORT"))
    except ValueError as exc:
        raise MailDeliveryError("invalid SMTP configuration") from exc
    if port not in (465, 587) or not _valid_email(from_email) or not _valid_email(to_email):
        raise MailDeliveryError("invalid SMTP configuration")

    email = EmailMessage()
    email["Subject"] = f"Portfolio Contact: {contact.name}"
    email["From"] = from_email
    email["To"] = to_email
    email["Reply-To"] = contact.email
    email.set_content(
        "New portfolio contact message\n\n"
        f"Name:\n{contact.name}\n\n"
        f"Email:\n{contact.email}\n\n"
        f"Message:\n{contact.message}\n"
    )

    context = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=12, context=context) as smtp:
                smtp.login(username, password)
                refused = smtp.send_message(email)
        else:
            with smtplib.SMTP(host, port, timeout=12) as smtp:
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.ehlo()
                smtp.login(username, password)
                refused = smtp.send_message(email)
        if refused:
            raise MailDeliveryError("SMTP server refused a recipient")
    except (OSError, TimeoutError, smtplib.SMTPException) as exc:
        logger.warning("SMTP submission failed: %s", type(exc).__name__)
        raise MailDeliveryError("SMTP submission failed") from exc


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.post("/api/contact", response_model=ContactResponse)
def contact(contact_request: ContactRequest) -> ContactResponse:
    if contact_request.website:
        raise HTTPException(status_code=400, detail="Request rejected")
    try:
        _send_email(contact_request)
    except MailDeliveryError as exc:
        raise HTTPException(
            status_code=503,
            detail="The message could not be sent. Please try again later.",
        ) from exc
    return ContactResponse(accepted=True)
