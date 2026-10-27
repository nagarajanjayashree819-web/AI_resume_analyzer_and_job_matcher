
"use strict";

const form = document.getElementById("resumeForm");
const fileInput = document.getElementById("resume");
const dropzone = document.getElementById("dropzone");
const fileName = document.getElementById("fileName");
const jobsInput = document.getElementById("jobs");
const analyzeBtn = document.getElementById("analyzeBtn");
const errorBox = document.getElementById("error");
const resultsSection = document.getElementById("results");
const resumeEditor = document.getElementById("resumeEditor");
const resumePreview = document.getElementById("resumePreview");

let latestAnalysis = null;

fileInput.addEventListener("change", () => {
    fileName.textContent = fileInput.files[0]?.name || "No file selected";
});

["dragenter", "dragover"].forEach(type => {
    dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.add("dragover");
    });
});

["dragleave", "drop"].forEach(type => {
    dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
    });
});

dropzone.addEventListener("drop", event => {
    const file = event.dataTransfer.files[0];
    if (!file) return;

    const allowed = /\.(pdf|docx|txt)$/i.test(file.name);
    if (!allowed) {
        showError("Only PDF, DOCX, and TXT files are supported.");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showError("File is too large. Maximum size is 5 MB.");
        return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileName.textContent = file.name;
    errorBox.textContent = "";
});

document.getElementById("sampleJob").addEventListener("click", () => {
    jobsInput.value = `Data Analyst
Required skills: Python, SQL, Excel, Power BI, statistics, data analysis, data cleaning, data visualization, pandas and NumPy.
Responsibilities: Collect and clean data, create dashboards, analyze trends, write SQL queries and prepare reports.
Qualifications: Analytical thinking, attention to detail and communication skills.`;
    jobsInput.focus();
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    errorBox.textContent = "";

    if (!fileInput.files.length) {
        showError("Please choose a resume file.");
        return;
    }

    if (!jobsInput.value.trim()) {
        showError("Please enter at least one target job description.");
        return;
    }

    if (fileInput.files[0].size > 5 * 1024 * 1024) {
        showError("File is too large. Maximum size is 5 MB.");
        return;
    }

    const originalContent = analyzeBtn.innerHTML;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing resume…";

    try {
        const response = await fetch("/analyze", {
            method: "POST",
            body: new FormData(form)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Analysis failed. Please try again.");
        }

        latestAnalysis = data;
        renderAnalysis(data);

        // Populate the editor with extracted resume text.
        resumeEditor.value = data.resume_text || "";
        renderPreview();

        resultsSection.classList.remove("hidden");

        resultsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        showError(error.message || "Could not connect to the server.");
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = originalContent;
    }
});

function showError(message) {
    errorBox.textContent = message;
}

function renderAnalysis(data) {
    const results = Array.isArray(data.results) ? data.results : [];
    const skills = Array.isArray(data.resume_skills) ? data.resume_skills : [];

    const score = clamp(data.ats_score);
    const coverage = clamp(data.keyword_coverage);

    document.getElementById("atsScore").innerHTML =
        `${score}<small>/100</small>`;
    document.getElementById("atsBar").style.width = `${score}%`;

    document.getElementById("coverage").innerHTML =
        `${coverage}<small>%</small>`;
    document.getElementById("coverageBar").style.width = `${coverage}%`;

    document.getElementById("skillsTotal").textContent = skills.length;
    document.getElementById("jobsTotal").textContent = results.length;
    document.getElementById("sectionsText").textContent =
        `${Number(data.sections_detected) || 0} common resume sections detected`;

    renderCoverageChart(results);
    renderSkillMap(skills);
    renderJobResults(results);
}

function clamp(value) {
    const number = Number(value);
    return Number.isFinite(number)
        ? Math.min(100, Math.max(0, number))
        : 0;
}

function renderCoverageChart(results) {
    const chart = document.getElementById("coverageChart");
    chart.replaceChildren();

    if (!results.length) {
        chart.textContent = "No job descriptions were analyzed.";
        return;
    }

    results.forEach((job, index) => {
        const row = document.createElement("div");
        row.className = "bar-row";

        const label = document.createElement("span");
        label.className = "bar-label";
        label.textContent = job.job_title || `Job ${index + 1}`;

        const track = document.createElement("div");
        track.className = "bar-track";

        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = `${clamp(job.keyword_coverage)}%`;
        track.appendChild(fill);

        const value = document.createElement("span");
        value.className = "bar-value";
        value.textContent = `${clamp(job.keyword_coverage)}%`;

        row.append(label, track, value);
        chart.appendChild(row);
    });
}

function renderSkillMap(skills) {
    const heatmap = document.getElementById("skillHeatmap");
    heatmap.replaceChildren();

    if (!skills.length) {
        heatmap.textContent = "No recognized skills found in the resume.";
        return;
    }

    skills.forEach(skill => {
        const chip = document.createElement("span");
        chip.className = "skill-chip";
        chip.textContent = skill;
        heatmap.appendChild(chip);
    });
}

function renderJobResults(results) {
    const container = document.getElementById("jobResults");
    container.replaceChildren();

    if (!results.length) {
        container.textContent = "No job results are available.";
        return;
    }

    results.forEach((job, index) => {
        const card = document.createElement("article");
        card.className = "job-result";

        const heading = document.createElement("div");
        heading.className = "job-result-head";

        const titleArea = document.createElement("div");
        const title = document.createElement("h4");
        title.textContent = `${index + 1}. ${job.job_title || `Job ${index + 1}`}`;

        const subtitle = document.createElement("span");
        subtitle.className = "muted";
        subtitle.textContent = "Text similarity score";

        titleArea.append(title, subtitle);

        const score = document.createElement("span");
        score.className = "score-pill";
        score.textContent = `${clamp(job.score)}% match`;

        heading.append(titleArea, score);

        const progress = document.createElement("div");
        progress.className = "job-progress";

        const progressFill = document.createElement("i");
        progressFill.style.width = `${clamp(job.score)}%`;
        progress.appendChild(progressFill);

        const columns = document.createElement("div");
        columns.className = "skill-columns";

        columns.append(
            makeSkillColumn("Matching skills", job.matched_skills, true),
            makeSkillColumn("Skills not detected", job.missing_skills, false)
        );

        card.append(heading, progress, columns);
        container.appendChild(card);
    });
}

function makeSkillColumn(title, skills, matched) {
    const column = document.createElement("div");
    const heading = document.createElement("h5");
    heading.className = matched ? "match-heading" : "missing-heading";

    const list = Array.isArray(skills) ? skills : [];
    heading.textContent = `${matched ? "✓" : "+"} ${title} (${list.length})`;

    const content = document.createElement("div");

    if (!list.length) {
        const empty = document.createElement("span");
        empty.className = "empty-note";
        empty.textContent = matched
            ? "No matching skills detected"
            : "No missing listed skills";
        content.appendChild(empty);
    } else {
        list.forEach(skill => {
            const chip = document.createElement("span");
            chip.className = "skill-chip";

            if (!matched) {
                chip.style.background = "#fff0f2";
                chip.style.color = "#ad4054";
                chip.style.borderColor = "#f6d9de";
            }

            chip.textContent = skill;
            content.appendChild(chip);
        });
    }

    column.append(heading, content);
    return column;
}

function renderPreview() {
    const text = resumeEditor.value.trim();
    resumePreview.replaceChildren();

    if (!text) {
        const placeholder = document.createElement("div");
        placeholder.className = "preview-placeholder";

        const icon = document.createElement("span");
        icon.className = "preview-icon";
        icon.textContent = "▤";

        const title = document.createElement("h3");
        title.textContent = "Your resume preview";

        const message = document.createElement("p");
        message.textContent = "Upload and analyze a resume to preview its content.";

        placeholder.append(icon, title, message);
        resumePreview.appendChild(placeholder);
        return;
    }

    // textContent prevents resume text from being interpreted as HTML.
    resumePreview.textContent = text;
}

resumeEditor.addEventListener("input", renderPreview);

document.querySelectorAll(".template-tab").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".template-tab").forEach(tab => {
            tab.classList.toggle("active", tab === button);
        });

        resumePreview.classList.remove("modern", "classic", "professional");
        resumePreview.classList.add(button.dataset.template);
    });
});

document.getElementById("downloadResume").addEventListener("click", () => {
    const text = resumeEditor.value.trim();

    if (!text) {
        alert("Analyze a resume first, then edit the extracted text.");
        return;
    }

    downloadBlob(text, "edited_resume.txt", "text/plain;charset=utf-8");
});

document.getElementById("downloadReport").addEventListener("click", async () => {
    if (!latestAnalysis) {
        alert("Analyze a resume first.");
        return;
    }

    const button = document.getElementById("downloadReport");
    button.disabled = true;

    try {
        const response = await fetch("/download-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(latestAnalysis)
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Could not create the PDF report.");
        }

        const blob = await response.blob();
        downloadBlob(blob, "resume_analysis_report.pdf", "application/pdf");
    } catch (error) {
        alert(error.message || "PDF download failed.");
    } finally {
        button.disabled = false;
    }
});

function downloadBlob(content, filename, type) {
    const blob = content instanceof Blob
        ? content
        : new Blob([content], { type });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Delay revocation so the browser can start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
