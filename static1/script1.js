/* ========================================
   1. DOM Elements and Global Variables
======================================== */

const form = document.getElementById('resumeForm');
const fileInput = document.getElementById('resume');
const dropzone = document.getElementById('dropzone');
const fileName = document.getElementById('fileName');
const jobsInput = document.getElementById('jobs');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorBox = document.getElementById('error');
const resultsSection = document.getElementById('results');
const resumeEditor = document.getElementById('resumeEditor');
const resumePreview = document.getElementById('resumePreview');

let latestAnalysis = null;


/* ========================================
   2. Resume File Selection
======================================== */

fileInput.addEventListener('change', () => {
    fileName.textContent =
        fileInput.files[0]?.name || 'No file selected';
});


/* ========================================
   3. Drag and Drop Resume Upload
======================================== */

// Highlight the dropzone when dragging a file over it.
['dragenter', 'dragover'].forEach(type => {
    dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.add('dragover');
    });
});

// Remove the highlight when dragging away or dropping a file.
['dragleave', 'drop'].forEach(type => {
    dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.remove('dragover');
    });
});

// Handle the dropped resume file.
dropzone.addEventListener('drop', event => {
    const file = event.dataTransfer.files[0];

    if (file) {
        const dataTransfer = new DataTransfer();

        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        fileName.textContent = file.name;
    }
});


/* ========================================
   4. Insert Sample Job Description
======================================== */

document.getElementById('sampleJob').addEventListener('click', () => {
    jobsInput.value = `Data Analyst
Required skills: Python, SQL, Excel, Power BI, statistics, data analysis, data cleaning, data visualization, pandas and NumPy.
Responsibilities: Collect and clean data, create dashboards, analyze trends, write SQL queries and prepare reports.
Qualifications: Analytical thinking, attention to detail and communication skills.`;

    jobsInput.focus();
});


/* ========================================
   5. Resume Analysis Form Submission
======================================== */

form.addEventListener('submit', async event => {
    event.preventDefault();

    errorBox.textContent = '';

    // Validate resume selection.
    if (!fileInput.files.length) {
        errorBox.textContent = 'Please choose a resume file.';
        return;
    }

    // Validate job description.
    if (!jobsInput.value.trim()) {
        errorBox.textContent =
            'Please enter at least one target job description.';
        return;
    }

    const originalButtonContent = analyzeBtn.innerHTML;

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing resume…';

    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            body: new FormData(form)
        });

        // Handle non-JSON server responses safely.
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || 'Analysis failed. Please try again.'
            );
        }

        // Save and display analysis results.
        latestAnalysis = data;

        renderAnalysis(data);

        resultsSection.classList.remove('hidden');

        // Populate the resume editor.
        if (data.resume_text) {
            resumeEditor.value = data.resume_text;
        }

        renderPreview();

        // Scroll to the results dashboard.
        setTimeout(() => {
            resultsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);

    } catch (error) {
        errorBox.textContent =
            error.message ||
            'Could not connect to the server. Check that app1.py is running.';

    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = originalButtonContent;
    }
});


/* ========================================
   6. Render Analysis Dashboard
======================================== */

function renderAnalysis(data) {
    const atsScore = Number(data.ats_score) || 0;
    const keywordCoverage = Number(data.keyword_coverage) || 0;

    const resumeSkills = data.resume_skills || [];
    const results = data.results || [];

    // Update summary metrics.
    document.getElementById('atsScore').innerHTML =
        `${atsScore}<small>/100</small>`;

    document.getElementById('atsBar').style.width =
        `${Math.min(100, atsScore)}%`;

    document.getElementById('coverage').innerHTML =
        `${keywordCoverage}<small>%</small>`;

    document.getElementById('coverageBar').style.width =
        `${Math.min(100, keywordCoverage)}%`;

    document.getElementById('skillsTotal').textContent =
        resumeSkills.length;

    document.getElementById('jobsTotal').textContent =
        results.length;

    document.getElementById('sectionsText').textContent =
        `${data.sections_detected || 0} common resume sections detected`;


    /* ------------------------------------
       6.1 Keyword Coverage Chart
    ------------------------------------ */

    const chart = document.getElementById('coverageChart');

    chart.innerHTML = '';

    results.forEach(job => {
        const row = document.createElement('div');

        row.className = 'bar-row';

        const title = esc(job.job_title || 'Untitled job');
        const coverage = Math.min(
            100,
            Number(job.keyword_coverage) || 0
        );

        row.innerHTML = `
            <span class="bar-label" title="${title}">
                ${title}
            </span>

            <div class="bar-track">
                <div
                    class="bar-fill"
                    style="width: ${coverage}%"
                ></div>
            </div>

            <span class="bar-value">
                ${Number(job.keyword_coverage) || 0}%
            </span>
        `;

        chart.appendChild(row);
    });

    if (results.length === 0) {
        chart.innerHTML = `
            <p class="empty-note">
                No job descriptions were analyzed.
            </p>
        `;
    }


    /* ------------------------------------
       6.2 Resume Skills Map
    ------------------------------------ */

    const heatmap = document.getElementById('skillHeatmap');

    heatmap.innerHTML = '';

    resumeSkills.forEach(skill => {
        const skillElement = document.createElement('span');

        skillElement.className = 'skill-chip';
        skillElement.textContent = skill;

        heatmap.appendChild(skillElement);
    });

    if (heatmap.children.length === 0) {
        heatmap.innerHTML = `
            <p class="empty-note">
                No recognized skills found. Try a text-based resume
                with a skills section.
            </p>
        `;
    }


    /* ------------------------------------
       6.3 Job Match Results
    ------------------------------------ */

    const jobsContainer = document.getElementById('jobResults');

    jobsContainer.innerHTML = '';

    results.forEach((job, index) => {
        const card = document.createElement('article');

        card.className = 'job-result';

        const matchedSkills = job.matched_skills || [];
        const missingSkills = job.missing_skills || [];

        const jobTitle = esc(
            job.job_title || `Job ${index + 1}`
        );

        const score = Math.min(
            100,
            Math.max(0, Number(job.score) || 0)
        );

        const matchedHTML = matchedSkills.length
            ? matchedSkills.map(skill => `
                <span class="skill-chip">${esc(skill)}</span>
            `).join('')
            : '<span class="empty-note">No detected matching skills</span>';

        const missingHTML = missingSkills.length
            ? missingSkills.map(skill => `
                <span
                    class="skill-chip"
                    style="background:#fff0f2;color:#ad4054;border-color:#f6d9de"
                >
                    ${esc(skill)}
                </span>
            `).join('')
            : '<span class="empty-note">No missing listed skills</span>';

        card.innerHTML = `
            <div class="job-result-head">
                <div>
                    <h4>${index + 1}. ${jobTitle}</h4>
                    <span class="muted">Text similarity score</span>
                </div>

                <span class="score-pill">
                    ${score}% match
                </span>
            </div>

            <div class="job-progress">
                <i style="width:${score}%"></i>
            </div>

            <div class="skill-columns">

                <div>
                    <h5 class="match-heading">
                        ✓ Matching skills (${matchedSkills.length})
                    </h5>

                    <div>${matchedHTML}</div>
                </div>

                <div>
                    <h5 class="missing-heading">
                        + Skills not detected (${missingSkills.length})
                    </h5>

                    <div>${missingHTML}</div>
                </div>

            </div>
        `;

        jobsContainer.appendChild(card);
    });
}


/* ========================================
   7. Escape HTML
======================================== */

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}


/* ========================================
   8. Resume Preview
======================================== */

function renderPreview() {
    const text = resumeEditor.value.trim();

    if (!text) {
        resumePreview.innerHTML = `
            <div class="preview-placeholder">
                <span class="preview-icon">▤</span>

                <h3>Your resume preview</h3>

                <p>
                    Upload and analyze a resume to preview its content.
                </p>
            </div>
        `;

        return;
    }

    // Use textContent to display resume text safely.
    resumePreview.textContent = text;
}

// Update the preview whenever the user edits the resume.
resumeEditor.addEventListener('input', renderPreview);


/* ========================================
   9. Resume Template Selection
======================================== */

document.querySelectorAll('.template-tab').forEach(button => {
    button.addEventListener('click', () => {

        // Update the active tab.
        document.querySelectorAll('.template-tab').forEach(tab => {
            tab.classList.toggle('active', tab === button);
        });

        // Change the resume preview style.
        resumePreview.classList.remove(
            'modern',
            'classic',
            'professional'
        );

        resumePreview.classList.add(button.dataset.template);
    });
});


/* ========================================
   10. Download Edited Resume
======================================== */

document.getElementById('downloadResume').addEventListener('click', () => {
    const text = resumeEditor.value.trim();

    if (!text) {
        alert('Analyze a resume first, then edit the extracted text.');
        return;
    }

    downloadBlob(
        text,
        'edited_resume.txt',
        'text/plain;charset=utf-8'
    );
});


/* ========================================
   11. Download PDF Analysis Report
======================================== */

document.getElementById('downloadReport').addEventListener(
    'click',
    async () => {

        if (!latestAnalysis) {
            alert('Analyze a resume first.');
            return;
        }

        try {
            const response = await fetch('/download-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(latestAnalysis)
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));

                throw new Error(
                    data.error || 'PDF report could not be created.'
                );
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');

            link.href = url;
            link.download = 'resume_analysis_report.pdf';

            document.body.appendChild(link);
            link.click();
            link.remove();

            URL.revokeObjectURL(url);

        } catch (error) {
            alert(error.message);
        }
    }
);


/* ========================================
   12. General File Download Helper
======================================== */

function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}
``` code for script1.js
   

   
