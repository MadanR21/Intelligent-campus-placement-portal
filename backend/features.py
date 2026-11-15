
import os
import secrets
from pathlib import Path
from datetime import datetime, timezone
from fastapi.responses import FileResponse

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    UploadFile,
    File
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from bson import ObjectId
from jose import jwt, JWTError

from email_service import send_interview_email

from database import (
    users_collection,
    jobs_collection,
    applications_collection,
    resumes_collection,
    interviews_collection,
    notifications_collection
)

# =========================================
# ROUTER CONFIGURATION
# =========================================

router = APIRouter()

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "campusconnect_change_this_to_a_long_random_secret_key"
)

ALGORITHM = "HS256"

security = HTTPBearer()

BASE_DIR = Path(__file__).resolve().parent

RESUME_DIR = BASE_DIR / "uploads" / "resumes"

RESUME_DIR.mkdir(parents=True, exist_ok=True)

MAX_RESUME_SIZE = 5 * 1024 * 1024

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}


# =========================================
# AUTHENTICATION
# =========================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id or not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token."
            )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    user = users_collection.find_one({
        "_id": ObjectId(user_id)
    })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found."
        )

    return {
        "user_id": str(user["_id"]),
        "name": user.get("full_name"),
        "email": user.get("email"),
        "role": user.get("role")
    }


def require_role(user, roles):
    if user["role"] not in roles:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )


def create_notification(user_id, title, message, category):
    notifications_collection.insert_one({
        "user_id": ObjectId(user_id),
        "title": title,
        "message": message,
        "category": category,
        "is_read": False,
        "created_at": datetime.now(timezone.utc)
    })


def serialize_notification(notification):
    created_at = notification.get("created_at")

    return {
        "id": str(notification["_id"]),
        "title": notification.get("title"),
        "message": notification.get("message"),
        "category": notification.get("category"),
        "is_read": notification.get("is_read", False),
        "created_at": (
            created_at.isoformat()
            if isinstance(created_at, datetime)
            else created_at
        )
    }


# =========================================
# INTERVIEW REQUEST MODEL
# =========================================

class InterviewCreate(BaseModel):
    application_id: str
    scheduled_at: datetime
    interview_mode: str = "Online"
    meeting_link: str = ""
    location: str = ""
    notes: str = ""


# =========================================
# RESUME UPLOAD
# =========================================

@router.post("/students/resume")
async def upload_resume(
    resume: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["student"])

    extension = Path(resume.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, DOC and DOCX resumes are allowed."
        )

    content = await resume.read(MAX_RESUME_SIZE + 1)

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded resume is empty."
        )

    if len(content) > MAX_RESUME_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Resume size must not exceed 5 MB."
        )

    if extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid PDF file."
        )

    student_id = ObjectId(current_user["user_id"])

    filename = secrets.token_hex(16) + extension

    file_path = RESUME_DIR / filename

    try:
        with open(file_path, "wb") as file:
            file.write(content)

        existing_resume = resumes_collection.find_one({
            "student_id": student_id
        })

        resume_data = {
            "student_id": student_id,
            "filename": resume.filename,
            "stored_filename": filename,
            "file_path": str(file_path),
            "file_size": len(content),
            "uploaded_at": datetime.now(timezone.utc)
        }

        if existing_resume:
            old_file = existing_resume.get("file_path")

            resumes_collection.update_one(
                {"_id": existing_resume["_id"]},
                {"$set": resume_data}
            )

            if old_file and Path(old_file).is_file():
                Path(old_file).unlink()

        else:
            resumes_collection.insert_one(resume_data)

    except Exception:
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="Unable to save resume."
        )

    return {
        "message": "Resume uploaded successfully.",
        "filename": resume.filename,
        "size": len(content)
    }


# =========================================
# VIEW OWN RESUME DETAILS
# =========================================

@router.get("/students/resume")
def get_student_resume(
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["student"])

    resume = resumes_collection.find_one({
        "student_id": ObjectId(current_user["user_id"])
    })

    if not resume:
        return {
            "uploaded": False,
            "message": "No resume uploaded."
        }

    uploaded_at = resume.get("uploaded_at")

    return {
        "uploaded": True,
        "filename": resume.get("filename"),
        "file_size": resume.get("file_size"),
        "uploaded_at": (
            uploaded_at.isoformat()
            if isinstance(uploaded_at, datetime)
            else uploaded_at
        )
    }


# =========================================
# RECRUITER - VIEW APPLICANT RESUME
# =========================================

@router.get("/recruiter/applications/{application_id}/resume")
def get_applicant_resume(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])

    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=400, detail="Invalid application ID.")

    application = applications_collection.find_one({
        "_id": ObjectId(application_id)
    })

    if not application:
        raise HTTPException(status_code=404, detail="Application not found.")

    job_id = application.get("job_id")

    if not isinstance(job_id, ObjectId):
        if not ObjectId.is_valid(str(job_id)):
            raise HTTPException(status_code=400, detail="Invalid job ID.")
        job_id = ObjectId(str(job_id))

    job = jobs_collection.find_one({"_id": job_id})

    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if str(job.get("recruiter_id")) != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    resume = resumes_collection.find_one({
        "student_id": application["student_id"]
    })

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Student has not uploaded a resume."
        )

    file_path = Path(resume.get("file_path", ""))

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Resume file not found.")

    extension = file_path.suffix.lower()

    media_types = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }

    return FileResponse(
        path=str(file_path),
        media_type=media_types.get(extension, "application/octet-stream"),
        filename=resume.get("filename", "resume"),
        content_disposition_type="inline"
    )


# =========================================
# SCHEDULE INTERVIEW
# =========================================

@router.post("/interviews")
def schedule_interview(
    interview: InterviewCreate,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])

    if not ObjectId.is_valid(interview.application_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid application ID."
        )

    application = applications_collection.find_one({
        "_id": ObjectId(interview.application_id)
    })

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Application not found."
        )

    job_id = application.get("job_id")

    if not isinstance(job_id, ObjectId):
        if not ObjectId.is_valid(str(job_id)):
            raise HTTPException(
                status_code=400,
                detail="Invalid job reference."
            )

        job_id = ObjectId(str(job_id))

    job = jobs_collection.find_one({
        "_id": job_id
    })

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )

    recruiter_id = job.get("recruiter_id")

    if str(recruiter_id) != current_user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="You cannot schedule interviews for another recruiter's job."
        )

    scheduled_at = interview.scheduled_at

    if scheduled_at.tzinfo is None:
        raise HTTPException(
            status_code=400,
            detail="Interview date must include a timezone."
        )

    scheduled_at = scheduled_at.astimezone(timezone.utc)

    if scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="Interview must be scheduled in the future."
        )

    if interview.interview_mode not in ["Online", "Offline"]:
        raise HTTPException(
            status_code=400,
            detail="Interview mode must be Online or Offline."
        )

    if interview.interview_mode == "Online" and not interview.meeting_link:
        raise HTTPException(
            status_code=400,
            detail="Meeting link is required for online interviews."
        )

    if interview.interview_mode == "Offline" and not interview.location:
        raise HTTPException(
            status_code=400,
            detail="Interview location is required for offline interviews."
        )

    interview_data = {
        "application_id": ObjectId(interview.application_id),
        "student_id": application["student_id"],
        "recruiter_id": ObjectId(current_user["user_id"]),
        "job_id": job_id,
        "scheduled_at": scheduled_at,
        "interview_mode": interview.interview_mode,
        "meeting_link": interview.meeting_link,
        "location": interview.location,
        "notes": interview.notes,
        "status": "Scheduled",
        "created_at": datetime.now(timezone.utc)
    }

    result = interviews_collection.insert_one(interview_data)

    applications_collection.update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "status": "Shortlisted",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    create_notification(
        str(application["student_id"]),
        "Interview Scheduled",
        "Your interview has been scheduled. Please check your interview details.",
        "interview"
    )

    # Send interview email without interrupting scheduling
    # if SMTP is unavailable or not configured.

    try:
        student = users_collection.find_one({
            "_id": application["student_id"]
        })

        if student and student.get("email"):
            send_interview_email(
                student.get("full_name", "Student"),
                student["email"],
                job.get("job_title", job.get("title", "")),
                job.get("company_name", job.get("company", "")),
                scheduled_at.isoformat(),
                interview.interview_mode,
                interview.meeting_link
            )

    except Exception as email_error:
        print("Interview email notification failed:", email_error)

    return {
        "message": "Interview scheduled successfully.",
        "interview_id": str(result.inserted_id)
    }


# =========================================
# VIEW STUDENT INTERVIEWS
# =========================================

@router.get("/students/{student_id}/interviews")
def get_student_interviews(
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["student"])

    if current_user["user_id"] != student_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    interviews = interviews_collection.find({
        "student_id": ObjectId(student_id)
    }).sort("scheduled_at", 1)

    results = []

    for item in interviews:

        job = jobs_collection.find_one({
            "_id": item.get("job_id")
        })

        results.append({
            "id": str(item["_id"]),
            "application_id": str(item["application_id"]),

            "job_title": (
                job.get("job_title", job.get("title", ""))
                if job else ""
            ),

            "company_name": (
                job.get("company_name", job.get("company", ""))
                if job else ""
            ),

            "scheduled_at": item["scheduled_at"].isoformat(),
            "interview_mode": item["interview_mode"],
            "meeting_link": item.get("meeting_link", ""),
            "location": item.get("location", ""),
            "notes": item.get("notes", ""),
            "status": item.get("status", "Scheduled")
        })

    return results


# =========================================
# VIEW RECRUITER INTERVIEWS
# =========================================

@router.get("/recruiters/{recruiter_id}/interviews")
def get_recruiter_interviews(
    recruiter_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])

    if current_user["user_id"] != recruiter_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )

    interviews = interviews_collection.find({
        "recruiter_id": ObjectId(recruiter_id)
    }).sort("scheduled_at", 1)

    results = []

    for item in interviews:

        student = users_collection.find_one({
            "_id": item["student_id"]
        })

        job = jobs_collection.find_one({
            "_id": item.get("job_id")
        })

        results.append({
            "id": str(item["_id"]),
            "application_id": str(item["application_id"]),

            "student_name": (
                student.get("full_name", "")
                if student else ""
            ),

            "job_title": (
                job.get("job_title", job.get("title", ""))
                if job else ""
            ),

            "company_name": (
                job.get("company_name", job.get("company", ""))
                if job else ""
            ),

            "scheduled_at": item["scheduled_at"].isoformat(),
            "interview_mode": item["interview_mode"],
            "meeting_link": item.get("meeting_link", ""),
            "location": item.get("location", ""),
            "status": item.get("status", "Scheduled")
        })

    return results


# =========================================
# STUDENT NOTIFICATIONS
# =========================================

@router.get("/notifications")
def get_notifications(
    current_user: dict = Depends(get_current_user)
):
    notifications = notifications_collection.find({
        "user_id": ObjectId(current_user["user_id"])
    }).sort("created_at", -1)

    return [
        serialize_notification(item)
        for item in notifications
    ]


# =========================================
# UNREAD NOTIFICATION COUNT
# =========================================

@router.get("/notifications/unread-count")
def unread_notification_count(
    current_user: dict = Depends(get_current_user)
):
    count = notifications_collection.count_documents({
        "user_id": ObjectId(current_user["user_id"]),
        "is_read": False
    })

    return {
        "unread_count": count
    }


# =========================================
# MARK NOTIFICATION AS READ
# =========================================

@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid notification ID."
        )

    result = notifications_collection.update_one(
        {
            "_id": ObjectId(notification_id),
            "user_id": ObjectId(current_user["user_id"])
        },
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now(timezone.utc)
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found."
        )

    return {
        "message": "Notification marked as read."
    }
