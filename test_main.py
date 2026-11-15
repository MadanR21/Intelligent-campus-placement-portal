
import sys
from pathlib import Path

# Add backend folder to Python's import path
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


# =========================================
# BASIC APPLICATION TESTS
# =========================================

def test_application_starts():
    assert app is not None


def test_application_title():
    assert app.title == "Intelligent Campus Placement Portal"


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200


def test_api_documentation():
    response = client.get("/openapi.json")

    assert response.status_code == 200

    data = response.json()
    assert data["info"]["title"] == "Intelligent Campus Placement Portal"


# =========================================
# ROUTE TESTS
# =========================================

def get_registered_paths():
    response = client.get("/openapi.json")
    assert response.status_code == 200

    return response.json()["paths"]


def test_authentication_routes_exist():
    paths = get_registered_paths()

    assert "/register" in paths
    assert "/login" in paths
    assert "/auth/me" in paths


def test_job_routes_exist():
    paths = get_registered_paths()

    assert "/jobs" in paths


def test_resume_routes_exist():
    paths = get_registered_paths()

    assert "/students/resume" in paths


def test_interview_routes_exist():
    paths = get_registered_paths()

    assert "/interviews" in paths


def test_notification_routes_exist():
    paths = get_registered_paths()

    assert "/notifications" in paths
    assert "/notifications/unread-count" in paths
