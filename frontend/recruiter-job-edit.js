
/* ==========================================================
   CAREERSPHERE - RECRUITER JOB EDITING
   Uses existing FastAPI routes and JWT authentication.
========================================================== */

(function () {
    "use strict";

    const API_BASE_URL = "http://127.0.0.1:8000";

    const container = document.getElementById("recruiterJobsContainer");

    if (!container) return;

    let currentJobs = [];

    function getUser() {
        try {
            return JSON.parse(
                sessionStorage.getItem("campusconnectUser") || "null"
            );
        } catch {
            return null;
        }
    }

    function getUserId(user) {
        return user?.user_id || user?.id || user?._id || null;
    }

    function getToken(user) {
        return user?.access_token ||
            user?.token ||
            user?.accessToken ||
            user?.jwt ||
            null;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    async function apiRequest(url, options = {}) {
        const user = getUser();
        const token = getToken(user);

        if (!user || !token) {
            throw new Error("Your login session has expired. Please log in again.");
        }

        const headers = new Headers(options.headers || {});
        headers.set("Authorization", `Bearer ${token}`);

        if (options.body && !(options.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(API_BASE_URL + url, {
            ...options,
            headers
        });

        let result = {};

        try {
            result = await response.json();
        } catch {
            result = {};
        }

        if (!response.ok) {
            throw new Error(
                result.detail ||
                result.message ||
                "The request could not be completed."
            );
        }

        return result;
    }

    function showNotice(message, type = "success") {
        let notice = document.getElementById("recruiterEditNotice");

        if (!notice) {
            notice = document.createElement("div");
            notice.id = "recruiterEditNotice";
            notice.className = "alert";
            notice.setAttribute("role", "status");

            const main = document.querySelector("main");

            if (main) {
                main.prepend(notice);
            } else {
                document.body.prepend(notice);
            }
        }

        notice.className = `alert alert-${type} mx-3 mt-3`;
        notice.textContent = message;

        notice.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }

    function createDialog() {
        if (document.getElementById("recruiterEditDialog")) return;

        const dialog = document.createElement("dialog");

        dialog.id = "recruiterEditDialog";
        dialog.style.cssText = `
            width: min(760px, calc(100% - 24px));
            max-width: 760px;
            max-height: 90vh;
            overflow-y: auto;
            border: 0;
            border-radius: 18px;
            padding: 0;
            box-shadow: 0 24px 80px rgba(15, 23, 42, .25);
        `;

        dialog.innerHTML = `
            <div style="padding:26px">

                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h3 class="mb-1">Edit Job Opportunity</h3>
                        <p class="text-muted mb-0">
                            Update the details of your job posting.
                        </p>
                    </div>

                    <button
                        type="button"
                        class="btn-close"
                        id="recruiterEditClose"
                        aria-label="Close">
                    </button>
                </div>

                <div id="recruiterEditMessage"
                     class="alert d-none"
                     role="alert">
                </div>

                <form id="recruiterEditForm">

                    <input type="hidden" id="recruiterEditJobId">

                    <div class="row g-3">

                        <div class="col-md-6">
                            <label class="form-label" for="editCompany">
                                Company Name *
                            </label>
                            <input
                                class="form-control"
                                id="editCompany"
                                maxlength="150"
                                required>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="editTitle">
                                Job Title *
                            </label>
                            <input
                                class="form-control"
                                id="editTitle"
                                maxlength="150"
                                required>
                        </div>

                        <div class="col-12">
                            <label class="form-label" for="editDescription">
                                Job Description *
                            </label>
                            <textarea
                                class="form-control"
                                id="editDescription"
                                rows="5"
                                required>
                            </textarea>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="editDepartment">
                                Eligible Department
                            </label>
                            <input
                                class="form-control"
                                id="editDepartment"
                                placeholder="All Departments">
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="editSkills">
                                Required Skills
                            </label>
                            <input
                                class="form-control"
                                id="editSkills"
                                placeholder="Python, Java, SQL">
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="editCGPA">
                                Minimum CGPA
                            </label>
                            <input
                                type="number"
                                class="form-control"
                                id="editCGPA"
                                min="0"
                                max="10"
                                step="0.01">
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="editGraduationYear">
                                Eligible Graduation Year
                            </label>
                            <input
                                type="number"
                                class="form-control"
                                id="editGraduationYear"
                                min="2020"
                                max="2040">
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="editSalary">
                                Salary Package
                            </label>
                            <input
                                class="form-control"
                                id="editSalary"
                                placeholder="Example: 6.5 LPA">
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="editLocation">
                                Job Location
                            </label>
                            <input
                                class="form-control"
                                id="editLocation">
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="editDeadline">
                                Application Deadline
                            </label>
                            <input
                                type="date"
                                class="form-control"
                                id="editDeadline">
                        </div>

                    </div>

                    <hr class="my-4">

                    <div class="d-flex flex-wrap gap-2 justify-content-end">

                        <button
                            type="button"
                            class="btn btn-outline-secondary"
                            id="recruiterEditCancel">
                            Cancel
                        </button>

                        <button
                            type="submit"
                            class="btn btn-primary"
                            id="recruiterEditSave">
                            <i class="bi bi-check-circle"></i>
                            Save Changes
                        </button>

                    </div>

                </form>
            </div>
        `;

        document.body.appendChild(dialog);

        document.getElementById("recruiterEditClose")
            .addEventListener("click", () => dialog.close());

        document.getElementById("recruiterEditCancel")
            .addEventListener("click", () => dialog.close());

        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });

        document.getElementById("recruiterEditForm")
            .addEventListener("submit", saveJob);
    }

    function setField(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.value = value ?? "";
        }
    }

    function openEditDialog(job) {
        createDialog();

        setField("recruiterEditJobId", job.id);
        setField("editCompany", job.company_name || job.company);
        setField("editTitle", job.job_title || job.title);
        setField("editDescription", job.description);
        setField("editDepartment", job.eligible_department || job.department);
        setField("editSkills", job.required_skills || job.skills);
        setField("editCGPA", job.minimum_cgpa);
        setField(
            "editGraduationYear",
            job.eligible_graduation_year || job.graduation_year
        );
        setField("editSalary", job.salary_package || job.salary);
        setField("editLocation", job.job_location || job.location);
        setField(
            "editDeadline",
            job.application_deadline
                ? String(job.application_deadline).substring(0, 10)
                : ""
        );

        const message = document.getElementById("recruiterEditMessage");

        message.className = "alert d-none";
        message.textContent = "";

        document.getElementById("recruiterEditDialog").showModal();
    }

    function showFormError(message) {
        const box = document.getElementById("recruiterEditMessage");

        box.className = "alert alert-danger";
        box.textContent = message;
    }

    async function saveJob(event) {
        event.preventDefault();

        const saveButton = document.getElementById("recruiterEditSave");
        const jobId = document.getElementById("recruiterEditJobId").value;

        if (!jobId) {
            showFormError("Job ID is missing.");
            return;
        }

        const company = document.getElementById("editCompany").value.trim();
        const title = document.getElementById("editTitle").value.trim();
        const description = document.getElementById("editDescription").value.trim();

        if (!company || !title || !description) {
            showFormError("Company, job title and description are required.");
            return;
        }

        const cgpaValue = document.getElementById("editCGPA").value;
        const yearValue = document.getElementById("editGraduationYear").value;

        const cgpa = cgpaValue === "" ? 0 : Number(cgpaValue);
        const year = yearValue === "" ? null : Number(yearValue);

        if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) {
            showFormError("Minimum CGPA must be between 0 and 10.");
            return;
        }

        if (year !== null && (!Number.isInteger(year) || year < 2020 || year > 2040)) {
            showFormError("Enter a valid graduation year.");
            return;
        }

        const deadline = document.getElementById("editDeadline").value;

        if (deadline && deadline < new Date().toISOString().substring(0, 10)) {
            showFormError("Application deadline cannot be in the past.");
            return;
        }

        const payload = {
            company_name: company,
            job_title: title,
            description: description,
            minimum_cgpa: cgpa,
            eligible_department:
                document.getElementById("editDepartment").value.trim() || null,
            required_skills:
                document.getElementById("editSkills").value.trim() || null,
            eligible_graduation_year: year,
            salary_package:
                document.getElementById("editSalary").value.trim() || null,
            job_location:
                document.getElementById("editLocation").value.trim() || null,
            application_deadline: deadline || null
        };

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
            await apiRequest(
                `/jobs/${encodeURIComponent(jobId)}`,
                {
                    method: "PUT",
                    body: JSON.stringify(payload)
                }
            );

            document.getElementById("recruiterEditDialog").close();

            showNotice("Job opportunity updated successfully.", "success");

            await refreshJobs();

        } catch (error) {
            showFormError(error.message);
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML =
                '<i class="bi bi-check-circle"></i> Save Changes';
        }
    }

    async function refreshJobs() {
        const user = getUser();
        const userId = getUserId(user);

        if (!userId) return;

        currentJobs = await apiRequest(
            `/recruiters/${encodeURIComponent(userId)}/jobs`
        );

        addEditButtons();
    }

    function addEditButtons() {
        const cards = container.querySelectorAll(".recruiter-job-card");

        cards.forEach(card => {
            const actions = card.querySelector(".recruiter-job-actions");

            if (!actions || actions.querySelector(".recruiter-edit-job")) {
                return;
            }

            const title = card.querySelector(".recruiter-job-title")?.textContent?.trim();

            const matchingJob = currentJobs.find(job =>
                String(job.title || job.job_title || "").trim() === title
            );

            if (!matchingJob) return;

            const button = document.createElement("button");

            button.type = "button";
            button.className = "btn btn-outline-primary recruiter-edit-job";
            button.dataset.jobId = matchingJob.id;
            button.innerHTML = '<i class="bi bi-pencil-square"></i> Edit Job';

            actions.appendChild(button);
        });
    }

    container.addEventListener("click", event => {
        const button = event.target.closest(".recruiter-edit-job");

        if (!button) return;

        const job = currentJobs.find(item =>
            String(item.id) === String(button.dataset.jobId)
        );

        if (!job) {
            showNotice("Unable to load this job. Please refresh the page.", "danger");
            return;
        }

        openEditDialog(job);
    });

    const observer = new MutationObserver(() => {
        addEditButtons();
    });

    observer.observe(container, {
        childList: true,
        subtree: true
    });

    refreshJobs().catch(error => {
        console.error("Recruiter job editing initialization failed:", error);
    });

})();
