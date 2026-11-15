
import sys
from pathlib import Path
from datetime import datetime, timezone

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

# Add backend folder to Python import path
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import features
from main import app


client = TestClient(app)


# =========================================
# MOCK DATABASE COLLECTION
# =========================================

class FakeCollection:

    def __init__(self):
        self.data = []
        self.matched_count = 0

    def find_one(self, query):
        for item in self.data:
            if all(item.get(key) == value for key, value in query.items()):
                return item
        return None

    def insert_one(self, document):
        document = document.copy()
        document["_id"] = ObjectId()
        self.data.append(document)

        class Result:
            inserted_id = document["_id"]

        return Result()

    def update_one(self, query, update):
        self.matched_count = 0

        for item in self.data:
            if all(item.get(key) == value for key, value in query.items()):
                item.update(update.get("$set", {}))
                self.matched_count = 1
                break

        class Result:
            pass

        result = Result()
        result.matched_count = self.matched_count
        return result

    def find(self, query):
        results = [
            item for item in self.data
            if all(item.get(key) == value for key, value in query.items())
        ]

        return FakeCursor(results)

    def count_documents(self, query):
        return len(self.find(query).items)


class FakeCursor:

    def __init__(self, items):
        self.items = items

    def sort(self, field, direction):
        self.items.sort(
            key=lambda item: item.get(field) or datetime.min.replace(
                tzinfo=timezone.utc
            ),
            reverse=(direction == -1)
        )
        return self

    def __iter__(self):
        return iter(self.items)


# =========================================
# TEST CONFIGURATION
# =========================================

@pytest.fixture(autouse=True)
def reset_dependencies():
    app.dependency_overrides[features.get_current_user] = (
        lambda: {
            "user_id": str(ObjectId()),
            "name": "Test Student",
            "email": "student@test.com",
            "role": "student"
        }
    )

    yield

    app.dependency_overrides.clear()


@pytest.fixture
def fake_resume_database(monkeypatch):
    collection = FakeCollection()

    monkeypatch.setattr(
        features,
        "resumes_collection",
        collection
    )

    return collection


@pytest.fixture
def fake_notification_database(monkeypatch):
    collection = FakeCollection()

    monkeypatch.setattr(
        features,
        "notifications_collection",
        collection
    )

    return collection


# =========================================
# RESUME UPLOAD TESTS
# =========================================

def test_resume_upload_success(
    tmp_path,
    monkeypatch,
    fake_resume_database
):
    student_id = str(ObjectId())

    app.dependency_overrides[features.get_current_user] = (
        lambda: {
            "user_id": student_id,
            "name": "Test Student",
            "email": "student@test.com",
            "role": "student"
        }
    )

    monkeypatch.setattr(
        features,
        "RESUME_DIR",
        tmp_path
    )

    response = client.post(
        "/students/resume",
        files={
            "resume": (
                "resume.pdf",
                b"%PDF-1.4 test resume content",
                "application/pdf"
            )
        }
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Resume uploaded successfully."
    assert response.json()["filename"] == "resume.pdf"

    assert len(fake_resume_database.data) == 1
    assert list(tmp_path.iterdir())


def test_resume_upload_rejects_invalid_extension():
    response = client.post(
        "/students/resume",
        files={
            "resume": (
                "resume.exe",
                b"invalid file",
                "application/octet-stream"
            )
        }
    )

    assert response.status_code == 400
    assert "Only PDF, DOC and DOCX" in response.json()["detail"]


def test_resume_upload_rejects_empty_file():
    response = client.post(
        "/students/resume",
        files={
            "resume": (
                "resume.pdf",
                b"",
                "application/pdf"
            )
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "The uploaded resume is empty."


def test_resume_upload_rejects_invalid_pdf():
    response = client.post(
        "/students/resume",
        files={
            "resume": (
                "resume.pdf",
                b"This is not a PDF",
                "application/pdf"
            )
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid PDF file."


def test_resume_upload_rejects_large_file():
    large_content = b"%PDF-" + (b"A" * (5 * 1024 * 1024))

    response = client.post(
        "/students/resume",
        files={
            "resume": (
                "large_resume.pdf",
                large_content,
                "application/pdf"
            )
        }
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Resume size must not exceed 5 MB."


def test_student_resume_details_when_not_uploaded(
    fake_resume_database
):
    response = client.get("/students/resume")

    assert response.status_code == 200
    assert response.json()["uploaded"] is False


def test_resume_upload_rejects_recruiter():
    app.dependency_overrides[features.get_current_user] = (
        lambda: {
            "user_id": str(ObjectId()),
            "name": "Test Recruiter",
            "email": "recruiter@test.com",
            "role": "recruiter"
        }
    )

    response = client.post(
        "/students/resume",
        files={
            "resume": (
                "resume.pdf",
                b"%PDF-1.4 test",
                "application/pdf"
            )
        }
    )

    assert response.status_code == 403


# =========================================
# NOTIFICATION TESTS
# =========================================

def test_get_notifications(
    fake_notification_database
):
    student_id = ObjectId()

    app.dependency_overrides[features.get_current_user] = (
        lambda: {
            "user_id": str(student_id),
            "name": "Test Student",
            "email": "student@test.com",
            "role": "student"
        }
    )

    fake_notification_database.data.append({
        "_id": ObjectId(),
        "user_id": student_id,
        "title": "Application Update",
        "message": "Your application was shortlisted.",
        "category": "application",
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    })

    response = client.get("/notifications")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Application Update"


def test_unread_notification_count(
    fake_notification_database
):
    student_id = ObjectId()

    app.dependency_overrides[features.get_current_user] = (
        lambda: {
            "user_id": str(student_id),
            "name": "Test Student",
            "email": "student@test.com",
            "role": "student"
        }
    )

    fake_notification_database.data.extend([
        {
            "_id": ObjectId(),
            "user_id": student_id,
            "title": "Notification 1",
            "is_read": False
        },
        {
            "_id": ObjectId(),
            "user_id": student_id,
            "title": "Notification 2",
            "is_read": False
        },
        {
            "_id": ObjectId(),
            "user_id": student_id,
            "title": "Notification 3",
            "is_read": True
        }
    ])

    response = client.get("/notifications/unread-count")

    assert response.status_code == 200
    assert response.json()["unread_count"] == 2


def test_mark_notification_as_read(
    fake_notification_database
):
    student_id = ObjectId()
    notification_id = ObjectId()

    app.dependency_overrides[features.get_current_user] = (
        lambda: {
            "user_id": str(student_id),
            "name": "Test Student",
            "email": "student@test.com",
            "role": "student"
        }
    )

    fake_notification_database.data.append({
        "_id": notification_id,
        "user_id": student_id,
        "title": "Application Update",
        "is_read": False
    })

    response = client.put(
        f"/notifications/{notification_id}/read"
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Notification marked as read."

    assert fake_notification_database.data[0]["is_read"] is True


def test_mark_notification_with_invalid_id():
    response = client.put("/notifications/invalid-id/read")

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid notification ID."


def test_mark_nonexistent_notification_as_read():
    response = client.put(
        f"/notifications/{ObjectId()}/read"
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Notification not found."
