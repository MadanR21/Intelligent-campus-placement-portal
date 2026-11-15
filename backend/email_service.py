import os
import smtplib
from email.message import EmailMessage


def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Sends an email using SMTP configuration from environment variables.

    Returns True if the email is sent.
    Returns False if email is not configured or delivery fails.
    """

    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    sender_email = os.getenv("SENDER_EMAIL", smtp_username).strip()

    # Email is optional until SMTP credentials are configured.
    if not all([
        smtp_host,
        smtp_username,
        smtp_password,
        sender_email,
        to_email
    ]):
        print("Email not sent: SMTP configuration is incomplete.")
        return False

    message = EmailMessage()
    message["From"] = sender_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(message)

        print(f"Email successfully sent to {to_email}")
        return True

    except Exception as error:
        print("Email delivery failed:", error)
        return False


def send_application_status_email(
    student_name: str,
    student_email: str,
    job_title: str,
    company_name: str,
    application_status: str
) -> bool:

    subject = f"Application Update - {company_name}"

    body = f"""
Hello {student_name},

There is an update regarding your job application.

Company: {company_name}
Job Position: {job_title}
Application Status: {application_status}

Please log in to your CampusConnect account to view your application details.

Regards,
CampusConnect Placement Portal
"""

    return send_email(
        to_email=student_email,
        subject=subject,
        body=body
    )


def send_interview_email(
    student_name: str,
    student_email: str,
    job_title: str,
    company_name: str,
    interview_date: str,
    interview_mode: str,
    meeting_details: str
) -> bool:

    subject = f"Interview Scheduled - {company_name}"

    body = f"""
Hello {student_name},

An interview has been scheduled for your application.

Company: {company_name}
Job Position: {job_title}
Interview Date and Time: {interview_date}
Interview Mode: {interview_mode}
Interview Details: {meeting_details}

Please log in to CampusConnect for further information.

Best wishes,
CampusConnect Placement Portal
"""

    return send_email(
        to_email=student_email,
        subject=subject,
        body=body
    )