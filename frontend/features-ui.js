
/* =====================================================
   CAREERSPHERE - ADDITIONAL DASHBOARD FEATURES
   Resume Upload | Interviews | Notifications
===================================================== */

(function () {
    "use strict";

    const API_BASE_URL = "http://127.0.0.1:8000";

    let user = null;

    try {
        user = JSON.parse(
            sessionStorage.getItem("campusconnectUser") || "null"
        );
    } catch (error) {
        console.error("Unable to read user session:", error);
        return;
    }

    if (!user || !user.access_token) {
        console.warn("CareerSphere: No authenticated user session found.");
        return;
    }

    const userId = user.user_id || user.id || user._id;
    const role = String(user.role || "").toLowerCase();

    if (!userId) {
        console.error("CareerSphere: User ID is missing.");
        return;
    }

    /* =================================================
       API HELPER
    ================================================= */

    async function featureApi(url, options = {}) {
        const headers = new Headers(options.headers || {});

        headers.set(
            "Authorization",
            `Bearer ${user.access_token}`
        );

        const response = await fetch(API_BASE_URL + url, {
            ...options,
            headers
        });

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            let errorMessage = "Request failed.";

            if (typeof data.detail === "string") {
                errorMessage = data.detail;

            } else if (Array.isArray(data.detail)) {
                errorMessage = data.detail.map(item => {
                    if (typeof item === "string") return item;

                    const location = Array.isArray(item.loc)
                        ? item.loc.join(" → ")
                        : "";

                    return `${location}: ${item.msg || JSON.stringify(item)}`;
                }).join("\n");

            } else if (
                data.detail &&
                typeof data.detail === "object"
            ) {
                errorMessage = JSON.stringify(data.detail, null, 2);

            } else if (typeof data.message === "string") {
                errorMessage = data.message;
            }

            throw new Error(errorMessage);
        }

        return data;
    }

    /* =================================================
       SHARED UI HELPERS
    ================================================= */

    function createPanel(title, description) {
        const main = document.querySelector("main");

        if (!main) {
            console.error(
                "CareerSphere: Main element not found. Cannot create feature panel."
            );
            return null;
        }

        const section = document.createElement("section");

        section.className = "container my-4";

        const card = document.createElement("div");
        card.className = "card shadow-sm border-0";

        const cardBody = document.createElement("div");
        cardBody.className = "card-body p-4";

        const heading = document.createElement("h3");
        heading.className = "mb-2";
        heading.textContent = title;

        const paragraph = document.createElement("p");
        paragraph.className = "text-muted mb-3";
        paragraph.textContent = description;

        const content = document.createElement("div");
        content.className = "feature-content";

        cardBody.append(heading, paragraph, content);
        card.appendChild(cardBody);
        section.appendChild(card);
        main.appendChild(section);

        return content;
    }

    function showMessage(container, message, type = "info") {
        if (!container) return;

        container.innerHTML = "";

        const alertBox = document.createElement("div");
        alertBox.className = `alert alert-${type} mb-3`;
        alertBox.textContent = message;

        container.appendChild(alertBox);
    }

    function addButton(container, text, onClick) {
        if (!container) return null;

        const button = document.createElement("button");

        button.type = "button";
        button.className = "btn btn-primary btn-sm";
        button.textContent = text;
        button.addEventListener("click", onClick);

        container.appendChild(button);

        return button;
    }

    function safeText(value) {
        return value === null || value === undefined || value === ""
            ? "Not provided"
            : String(value);
    }

    function formatDate(value) {
        if (!value) return "Not provided";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Not provided";
        }

        return date.toLocaleString();
    }

    function getArrayResult(result, propertyName) {
        if (Array.isArray(result)) {
            return result;
        }

        if (result && Array.isArray(result[propertyName])) {
            return result[propertyName];
        }

        return [];
    }

    /* =================================================
       NOTIFICATIONS
    ================================================= */

    async function loadNotifications(container) {
        if (!container) return;

        container.innerHTML = "<p>Loading notifications...</p>";

        try {
            const result = await featureApi("/notifications");

            const notifications = getArrayResult(
                result,
                "notifications"
            );

            container.innerHTML = "";

            if (notifications.length === 0) {
                container.textContent = "You have no notifications.";
                return;
            }

            notifications.forEach(function (notification) {
                const item = document.createElement("div");

                item.className = "border rounded p-3 mb-2";

                const title = document.createElement("h6");
                title.textContent = safeText(notification.title);

                const message = document.createElement("p");
                message.className = "mb-1";
                message.textContent = safeText(notification.message);

                const date = document.createElement("small");
                date.className = "text-muted";
                date.textContent = notification.created_at
                    ? formatDate(notification.created_at)
                    : "";

                item.append(title, message, date);

                // Support all common notification ID field names.
                const notificationId =
                    notification.id ??
                    notification._id ??
                    notification.notification_id;

                const isRead =
                    notification.is_read === true ||
                    notification.read === true;

                if (!isRead && notificationId) {
                    const readButton = document.createElement("button");

                    readButton.type = "button";
                    readButton.className =
                        "btn btn-outline-primary btn-sm mt-2";

                    readButton.textContent = "Mark as read";

                    readButton.addEventListener("click", async function () {
                        try {
                            readButton.disabled = true;
                            readButton.textContent = "Updating...";

                            await featureApi(
                                `/notifications/${encodeURIComponent(notificationId)}/read`,
                                { method: "PUT" }
                            );

                            await loadNotifications(container);

                        } catch (error) {
                            readButton.disabled = false;
                            readButton.textContent = "Mark as read";

                            alert(error.message);
                        }
                    });

                    item.appendChild(readButton);
                }

                container.appendChild(item);
            });

        } catch (error) {
            showMessage(container, error.message, "danger");
        }
    }

    function setupNotifications() {
        const container = createPanel(
            "Notifications",
            "View important updates about your CareerSphere account."
        );

        if (!container) return;

        const list = document.createElement("div");
        list.className = "mt-3";

        addButton(container, "Refresh notifications", function () {
            loadNotifications(list);
        });

        container.appendChild(list);

        loadNotifications(list);
    }

    /* =================================================
       STUDENT - RESUME MANAGEMENT
    ================================================= */

    async function loadResume(container) {
        if (!container) return;

        container.innerHTML = "<p>Loading resume details...</p>";

        try {
            const result = await featureApi("/students/resume");

            const resume = result.resume || result;

            container.innerHTML = "";

            if (resume && (resume.filename || resume.file_name)) {
                const info = document.createElement("div");

                info.className = "alert alert-success mt-3";

                info.textContent =
                    "Uploaded resume: " +
                    safeText(resume.filename || resume.file_name);

                container.appendChild(info);

            } else {
                showMessage(
                    container,
                    "No resume uploaded yet. Select a file below to upload your resume.",
                    "secondary"
                );
            }

        } catch (error) {
            showMessage(container, error.message, "danger");
        }
    }

    function setupResumeUpload() {
        const container = createPanel(
            "Resume Management",
            "Upload your latest resume in PDF, DOC or DOCX format. Maximum file size: 5 MB."
        );

        if (!container) return;

        const form = document.createElement("form");
        form.className = "mt-3";

        form.innerHTML = `
            <div class="mb-3">
                <label
                    class="form-label fw-semibold"
                    for="campusResumeFile"
                >
                    Select Resume
                </label>

                <input
                    type="file"
                    class="form-control"
                    id="campusResumeFile"
                    accept=".pdf,.doc,.docx"
                    required
                >
            </div>

            <button type="submit" class="btn btn-primary">
                Upload Resume
            </button>
        `;

        const status = document.createElement("div");
        status.className = "mt-3";

        const resumeInfo = document.createElement("div");
        resumeInfo.className = "mt-3";

        container.append(form, status, resumeInfo);

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const fileInput = form.querySelector("#campusResumeFile");
            const file = fileInput.files[0];

            if (!file) {
                showMessage(
                    status,
                    "Please select a resume.",
                    "warning"
                );
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showMessage(
                    status,
                    "The resume must be smaller than 5 MB.",
                    "danger"
                );
                return;
            }

            const extension = file.name
                .split(".")
                .pop()
                .toLowerCase();

            if (!["pdf", "doc", "docx"].includes(extension)) {
                showMessage(
                    status,
                    "Only PDF, DOC and DOCX files are allowed.",
                    "danger"
                );
                return;
            }

            const formData = new FormData();
            formData.append("resume", file);

            const uploadButton = form.querySelector(
                'button[type="submit"]'
            );

            try {
                uploadButton.disabled = true;
                uploadButton.textContent = "Uploading...";

                showMessage(
                    status,
                    "Uploading resume...",
                    "info"
                );

                await featureApi("/students/resume", {
                    method: "POST",
                    body: formData
                });

                showMessage(
                    status,
                    "Resume uploaded successfully.",
                    "success"
                );

                form.reset();

                await loadResume(resumeInfo);

            } catch (error) {
                showMessage(status, error.message, "danger");

            } finally {
                uploadButton.disabled = false;
                uploadButton.textContent = "Upload Resume";
            }
        });

        loadResume(resumeInfo);
    }

    /* =================================================
       INTERVIEW DISPLAY
    ================================================= */

    function renderInterviews(container, interviews) {
        container.innerHTML = "";

        if (!Array.isArray(interviews) || interviews.length === 0) {
            container.textContent = "No interviews scheduled yet.";
            return;
        }

        interviews.forEach(function (interview) {
            const card = document.createElement("div");

            card.className = "border rounded p-3 mb-3";

            const heading = document.createElement("h6");

            heading.textContent =
                safeText(interview.job_title || "Interview");

            const company = document.createElement("p");
            company.className = "mb-1";
            company.textContent =
                "Company: " + safeText(interview.company_name);

            const date = document.createElement("p");
            date.className = "mb-1";
            date.textContent =
                "Scheduled: " + formatDate(interview.scheduled_at);

            const mode = document.createElement("p");
            mode.className = "mb-1";
            mode.textContent =
                "Mode: " + safeText(interview.interview_mode);

            card.append(heading, company, date, mode);

            if (interview.meeting_link) {
                try {
                    const meetingUrl = new URL(interview.meeting_link);

                    if (
                        meetingUrl.protocol === "https:" ||
                        meetingUrl.protocol === "http:"
                    ) {
                        const link = document.createElement("a");

                        link.href = meetingUrl.href;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        link.textContent = "Open meeting link";

                        card.appendChild(link);
                    }
                } catch (error) {
                    console.warn("Invalid interview meeting link.");
                }
            }

            if (interview.location) {
                const location = document.createElement("p");

                location.className = "mb-1";
                location.textContent =
                    "Location: " + safeText(interview.location);

                card.appendChild(location);
            }

            if (interview.notes) {
                const notes = document.createElement("p");

                notes.className = "mb-1";
                notes.textContent =
                    "Notes: " + safeText(interview.notes);

                card.appendChild(notes);
            }

            container.appendChild(card);
        });
    }

    async function loadInterviews(container, endpoint) {
        if (!container) return;

        container.innerHTML = "<p>Loading interviews...</p>";

        try {
            const result = await featureApi(endpoint);

            const interviews = getArrayResult(
                result,
                "interviews"
            );

            renderInterviews(container, interviews);

        } catch (error) {
            showMessage(container, error.message, "danger");
        }
    }

    /* =================================================
       STUDENT - MY INTERVIEWS
    ================================================= */

    function setupStudentInterviews() {
        const container = createPanel(
            "My Interviews",
            "View interviews scheduled by recruiters."
        );

        if (!container) return;

        const list = document.createElement("div");
        list.className = "mt-3";

        const endpoint =
            `/students/${encodeURIComponent(userId)}/interviews`;

        addButton(container, "Refresh interviews", function () {
            loadInterviews(list, endpoint);
        });

        container.appendChild(list);

        loadInterviews(list, endpoint);
    }

    /* =================================================
       RECRUITER - INTERVIEW SCHEDULING
    ================================================= */

    function setupRecruiterInterviews() {
        const container = createPanel(
            "Schedule an Interview",
            "Enter the application ID of the candidate you want to interview."
        );

        if (!container) return;

        const form = document.createElement("form");

        form.innerHTML = `
            <div class="mb-3">
                <label class="form-label">Application ID</label>

                <input
                    type="text"
                    class="form-control"
                    name="application_id"
                    placeholder="Paste the application ID"
                    required
                >
            </div>

            <div class="mb-3">
                <label class="form-label">
                    Interview Date and Time
                </label>

                <input
                    type="datetime-local"
                    class="form-control"
                    name="scheduled_at"
                    required
                >
            </div>

            <div class="mb-3">
                <label class="form-label">Interview Mode</label>

                <select class="form-select" name="interview_mode">
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                </select>
            </div>

            <div class="mb-3">
                <label class="form-label">
                    Meeting Link (for online interviews)
                </label>

                <input
                    type="url"
                    class="form-control"
                    name="meeting_link"
                    placeholder="https://..."
                >
            </div>

            <div class="mb-3">
                <label class="form-label">
                    Location (for offline interviews)
                </label>

                <input
                    type="text"
                    class="form-control"
                    name="location"
                    placeholder="Interview venue"
                >
            </div>

            <div class="mb-3">
                <label class="form-label">Additional Notes</label>

                <textarea
                    class="form-control"
                    name="notes"
                    rows="3"
                    placeholder="Optional instructions for the candidate"
                ></textarea>
            </div>

            <button type="submit" class="btn btn-primary">
                Schedule Interview
            </button>
        `;

        const status = document.createElement("div");
        status.className = "mt-3";

        container.append(form, status);

        const interviewList = document.createElement("div");
        interviewList.className = "mt-4";

        const heading = document.createElement("h5");
        heading.textContent = "Scheduled Interviews";

        container.append(heading, interviewList);

        const recruiterEndpoint =
            `/recruiters/${encodeURIComponent(userId)}/interviews`;

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const values = new FormData(form);
            const dateValue = values.get("scheduled_at");

            if (!dateValue) {
                showMessage(
                    status,
                    "Please select an interview date and time.",
                    "warning"
                );
                return;
            }

            const selectedDate = new Date(dateValue);

            if (Number.isNaN(selectedDate.getTime())) {
                showMessage(
                    status,
                    "Please enter a valid interview date and time.",
                    "warning"
                );
                return;
            }

            if (selectedDate.getTime() <= Date.now()) {
                showMessage(
                    status,
                    "Please select a future interview date and time.",
                    "warning"
                );
                return;
            }

            const applicationId = String(
                values.get("application_id") || ""
            ).trim();

            if (!applicationId) {
                showMessage(
                    status,
                    "Application ID is required.",
                    "warning"
                );
                return;
            }

            const interviewMode = values.get("interview_mode");

            const meetingLink = String(
                values.get("meeting_link") || ""
            ).trim();

            const location = String(
                values.get("location") || ""
            ).trim();

            if (interviewMode === "Online" && meetingLink) {
                try {
                    const parsedLink = new URL(meetingLink);

                    if (
                        parsedLink.protocol !== "https:" &&
                        parsedLink.protocol !== "http:"
                    ) {
                        throw new Error("Invalid protocol");
                    }
                } catch (error) {
                    showMessage(
                        status,
                        "Please enter a valid HTTP or HTTPS meeting link.",
                        "warning"
                    );
                    return;
                }
            }

            if (interviewMode === "Offline" && !location) {
                showMessage(
                    status,
                    "Please enter the interview location for an offline interview.",
                    "warning"
                );
                return;
            }

            const payload = {
                application_id: applicationId,
                scheduled_at: selectedDate.toISOString(),
                interview_mode: interviewMode,
                meeting_link: meetingLink,
                location: location,
                notes: String(
                    values.get("notes") || ""
                ).trim()
            };

            const scheduleButton = form.querySelector(
                'button[type="submit"]'
            );

            try {
                scheduleButton.disabled = true;
                scheduleButton.textContent = "Scheduling...";

                showMessage(
                    status,
                    "Scheduling interview...",
                    "info"
                );

                await featureApi("/interviews", {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(payload)
                });

                showMessage(
                    status,
                    "Interview scheduled successfully.",
                    "success"
                );

                form.reset();

                await loadInterviews(
                    interviewList,
                    recruiterEndpoint
                );

            } catch (error) {
                showMessage(status, error.message, "danger");

            } finally {
                scheduleButton.disabled = false;
                scheduleButton.textContent = "Schedule Interview";
            }
        });

        loadInterviews(
            interviewList,
            recruiterEndpoint
        );
    }

    /* =================================================
       INITIALIZE FEATURES BY ROLE
    ================================================= */

    function initializeFeatures() {
        if (window.campusConnectAccessBlocked) {
            return;
        }

        if (role === "student") {
            setupResumeUpload();
            setupStudentInterviews();
            setupNotifications();

        } else if (role === "recruiter") {
            setupRecruiterInterviews();
            setupNotifications();

        } else if (role === "admin") {
            setupNotifications();

        } else {
            console.warn(
                "CareerSphere: No additional features configured for role:",
                role
            );
        }
    }

    // Works whether this script loads before or after DOMContentLoaded.
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeFeatures,
            { once: true }
        );
    } else {
        initializeFeatures();
    }

})();
