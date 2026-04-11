// API Configuration
const API_BASE = "https://portifolio-yohl.onrender.com/api/projects";
const OWNER_LOGIN_API = "https://portifolio-yohl.onrender.com/api/owner/login";
const OWNER_SESSION_API = "https://portifolio-yohl.onrender.com/api/owner/session";
const OWNER_TOKEN_STORAGE_KEY = "portfolioOwnerToken";

// DOM Elements
const galleryContainer = document.getElementById("galleryContainer");
const cardTemplate = document.getElementById("projectCardTemplate");
const loginModal = document.getElementById("loginModal");
const uploadModal = document.getElementById("uploadModal");
const detailModal = document.getElementById("detailModal");
const ownerLoginBtn = document.getElementById("ownerLoginBtn");
const ownerLogoutBtn = document.getElementById("ownerLogoutBtn");
const heroOwnerBtn = document.getElementById("heroOwnerBtn");
const openUploadBtn = document.getElementById("openUploadBtn");
const heroUploadBtn = document.getElementById("heroUploadBtn");
const closeLoginModalBtn = document.getElementById("closeLoginModalBtn");
const cancelLoginBtn = document.getElementById("cancelLoginBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");
const loginForm = document.getElementById("loginForm");
const ownerPasswordInput = document.getElementById("ownerPassword");
const submitLoginBtn = document.getElementById("submitLoginBtn");
const uploadForm = document.getElementById("uploadForm");
const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const descriptionInput = document.getElementById("description");
const projectDateInput = document.getElementById("projectDate");
const fileInput = document.getElementById("fileInput");
const dropArea = document.getElementById("dropArea");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const uploadProgress = document.getElementById("uploadProgress");
const progressFill = document.getElementById("progressFill");
const progressPercent = document.getElementById("progressPercent");
const submitUploadBtn = document.getElementById("submitUploadBtn");
const imagePreview = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const removeImageBtn = document.getElementById("removeImageBtn");
const filterTabs = document.getElementById("filterTabs");
const loader = document.getElementById("loader");

// State
let selectedFile = null;
let currentProjects = [];
let currentFilter = "all";
let ownerToken = localStorage.getItem(OWNER_TOKEN_STORAGE_KEY) || "";
let isOwnerAuthenticated = Boolean(ownerToken);
let pendingOwnerAction = null;

function getDisplayDate(project) {
    return project.projectDate || project.createdAt;
}

function parseProjectDate(dateString) {
    if (!dateString) return null;

    const dateOnlyMatch = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(dateString);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Initialize AOS
AOS.init({
    duration: 800,
    once: true,
    offset: 100
});

// Hide loader after page load
window.addEventListener("load", () => {
    setTimeout(() => {
        loader.classList.add("fade-out");
        setTimeout(() => {
            loader.style.display = "none";
        }, 500);
    }, 500);
});

// Navigation scroll effect
window.addEventListener("scroll", () => {
    const navbar = document.getElementById("navbar");
    if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
    } else {
        navbar.classList.remove("scrolled");
    }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });
});

// Toast System
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "slideOutRight 0.3s ease";
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function formatDate(dateString) {
    const date = parseProjectDate(dateString);
    if (!date) return "Date not set";

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sanitizeFileName(value) {
    return String(value || "project")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "project";
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read image data."));
        reader.readAsDataURL(blob);
    });
}

async function getDownloadableImageSource(imageUrl) {
    try {
        const response = await fetch(imageUrl, { mode: "cors" });
        if (!response.ok) {
            throw new Error("Image download failed.");
        }

        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        return typeof dataUrl === "string" ? dataUrl : imageUrl;
    } catch (_error) {
        return imageUrl;
    }
}

function createProjectPdfCaptureNode(project, imageSource) {
    const wrapper = document.createElement("div");
    wrapper.className = "project-pdf-capture";
    wrapper.innerHTML = `
        <div class="modal-container modal-large project-pdf-capture-shell">
            <div class="modal-header">
                <div>
                    <div class="modal-tag">${escapeHtml(project.category || "Graphic Design")}</div>
                    <h3 class="modal-title">${escapeHtml(project.title)}</h3>
                </div>
            </div>
            <div class="project-detail-layout">
                <div class="project-detail-image-panel">
                    <img
                        src="${imageSource}"
                        alt="${escapeHtml(project.title)}"
                        class="project-detail-image"
                    >
                </div>
                <div class="project-detail-meta">
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <p style="color: var(--gray-600); line-height: 1.7;">${escapeHtml(project.description) || "No description provided."}</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Created</label>
                        <p style="color: var(--gray-500);">${formatDate(getDisplayDate(project))}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    return wrapper;
}

function waitForImages(container) {
    const images = Array.from(container.querySelectorAll("img"));
    return Promise.all(images.map((image) => {
        if (image.complete) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
        });
    }));
}

async function downloadProjectSnapshot(project) {
    const button = document.getElementById("downloadProjectBtn");
    if (button) {
        button.disabled = true;
    }

    try {
        if (typeof html2canvas === "undefined" || !window.jspdf?.jsPDF) {
            throw new Error("PDF export tools are not available.");
        }

        const imageSource = await getDownloadableImageSource(project.imageUrl);
        const captureNode = createProjectPdfCaptureNode(project, imageSource);
        document.body.appendChild(captureNode);
        await waitForImages(captureNode);

        const canvas = await html2canvas(captureNode, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff"
        });

        captureNode.remove();

        const { jsPDF } = window.jspdf;
        const pdfWidth = canvas.width;
        const pdfHeight = canvas.height;
        const pdf = new jsPDF(
            pdfWidth > pdfHeight ? "landscape" : "portrait",
            "pt",
            [pdfWidth, pdfHeight]
        );

        pdf.addImage(
            canvas.toDataURL("image/png"),
            "PNG",
            0,
            0,
            pdfWidth,
            pdfHeight
        );
        pdf.save(`${sanitizeFileName(project.title)}.pdf`);
        showToast("Project PDF downloaded.");
    } catch (error) {
        showToast(error.message || "Could not download project.", "error");
    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

function closeDetailModal() {
    detailModal.classList.remove("is-open");
    document.body.style.overflow = "";
}

// Modal Functions
function openLoginModal(nextAction = null) {
    pendingOwnerAction = nextAction;
    loginModal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    if (ownerPasswordInput) {
        ownerPasswordInput.value = "";
        setTimeout(() => ownerPasswordInput.focus(), 50);
    }
}

function closeLoginModal() {
    loginModal.classList.remove("is-open");
    document.body.style.overflow = "";
    if (loginForm) loginForm.reset();
}

function openModal() {
    if (!isOwnerAuthenticated) {
        openLoginModal("upload");
        return;
    }

    if (projectDateInput && !projectDateInput.value) {
        projectDateInput.value = new Date().toISOString().split("T")[0];
    }
    uploadModal.classList.add("is-open");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    uploadModal.classList.remove("is-open");
    uploadForm.reset();
    selectedFile = null;
    fileNameDisplay.textContent = "PNG, JPG, WEBP, or GIF (Max 10MB)";
    uploadProgress.style.display = "none";
    progressFill.style.width = "0%";
    if (progressPercent) progressPercent.textContent = "0%";
    imagePreview.style.display = "none";
    previewImg.src = "";
    document.body.style.overflow = "";
}

function setOwnerAuth(token) {
    ownerToken = token;
    isOwnerAuthenticated = Boolean(token);

    if (token) {
        localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, token);
    } else {
        localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
    }

    updateOwnerUI();
    filterProjects();
}

function clearOwnerAuth(showMessage = false) {
    pendingOwnerAction = null;
    setOwnerAuth("");
    closeLoginModal();
    closeModal();
    if (showMessage) {
        showToast("Owner session ended. Please log in again.", "error");
    }
}

function updateOwnerUI() {
    const ownerOnlyElements = [
        openUploadBtn,
        heroUploadBtn,
        ownerLogoutBtn,
        ...document.querySelectorAll(".delete-project-btn")
    ];

    ownerOnlyElements.forEach((element) => {
        if (element) {
            element.hidden = !isOwnerAuthenticated;
        }
    });

    if (ownerLoginBtn) ownerLoginBtn.hidden = isOwnerAuthenticated;
    if (heroOwnerBtn) heroOwnerBtn.hidden = isOwnerAuthenticated;
}

async function validateStoredOwnerSession() {
    if (!ownerToken) {
        setOwnerAuth("");
        return;
    }

    try {
        const response = await fetch(OWNER_SESSION_API, {
            headers: {
                Authorization: `Bearer ${ownerToken}`
            }
        });
        const payload = await response.json();

        if (!response.ok || !payload.authenticated) {
            clearOwnerAuth();
            return;
        }

        setOwnerAuth(ownerToken);
    } catch (error) {
        clearOwnerAuth();
    }
}

async function loginOwner(event) {
    event.preventDefault();

    const password = ownerPasswordInput?.value.trim();
    if (!password) {
        showToast("Enter the owner password to continue.", "error");
        return;
    }

    submitLoginBtn.disabled = true;

    try {
        const response = await fetch(OWNER_LOGIN_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ password })
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Owner login failed.");
        }

        setOwnerAuth(payload.token || "");
        closeLoginModal();

        const shouldOpenUploadModal = pendingOwnerAction === "upload";
        pendingOwnerAction = null;

        showToast(
            shouldOpenUploadModal
                ? "Owner login successful. Upload controls are ready."
                : (payload.message || "Owner login successful.")
        );

        if (shouldOpenUploadModal) {
            openModal();
        }
    } catch (error) {
        showToast(error.message || "Owner login failed.", "error");
    } finally {
        submitLoginBtn.disabled = false;
    }
}

function openDetailModal(project) {
    const detailContent = document.getElementById("detailContent");
    detailContent.innerHTML = `
        <div class="modal-header">
            <div>
                <div class="modal-tag">${project.category || "Graphic Design"}</div>
                <h3 class="modal-title">${escapeHtml(project.title)}</h3>
            </div>
            <button class="modal-close" id="closeDetailModal">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="project-detail-layout">
            <div class="project-detail-image-panel">
                <img
                    src="${project.imageUrl}"
                    alt="${escapeHtml(project.title)}"
                    class="project-detail-image"
                    loading="eager"
                >
            </div>
            <div class="project-detail-meta">
                <div class="project-detail-actions">
                    <button type="button" class="btn-primary project-detail-link project-detail-action-wide" id="downloadProjectBtn">
                        <i class="fa-solid fa-download"></i>
                        Download PDF
                    </button>
                    <a
                        href="${project.imageUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn-secondary project-detail-link project-detail-action-wide"
                    >
                        <i class="fa-regular fa-image"></i>
                        Open Full Image
                    </a>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <p style="color: var(--gray-600); line-height: 1.7;">${escapeHtml(project.description) || "No description provided."}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Created</label>
                    <p style="color: var(--gray-500);">${formatDate(getDisplayDate(project))}</p>
                </div>
            </div>
        </div>
    `;
    detailModal.classList.add("is-open");
    document.body.style.overflow = "hidden";

    document.getElementById("downloadProjectBtn").addEventListener("click", () => {
        downloadProjectSnapshot(project);
    });
    
    document.getElementById("closeDetailModal").addEventListener("click", closeDetailModal);
}

// Render Projects
function renderProjects(projects) {
    if (!projects.length) {
        galleryContainer.innerHTML = isOwnerAuthenticated ? `<div class="empty-state">
            <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: var(--space-md);"></i>
            <p>No projects yet. Upload your first design and it will appear here.</p>
            <button class="btn-primary" style="margin-top: var(--space-md);" onclick="document.getElementById('openUploadBtn').click()">
                Upload Your First Project
            </button>
        </div>` : `<div class="empty-state">
            <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: var(--space-md);"></i>
            <p>No projects have been published yet. Check back soon.</p>
        </div>`;
        return;
    }
    
    galleryContainer.innerHTML = "";
    
    projects.forEach((project) => {
        const fragment = cardTemplate.content.cloneNode(true);
        const card = fragment.querySelector(".project-card");
        const image = fragment.querySelector(".project-image");
        const category = fragment.querySelector(".project-category");
        const title = fragment.querySelector(".project-title");
        const description = fragment.querySelector(".project-description");
        const date = fragment.querySelector(".project-date");
        const deleteButton = fragment.querySelector(".delete-project-btn");
        const viewButton = fragment.querySelector(".view-project-btn");
        
        image.src = project.imageUrl;
        image.alt = project.title;
        image.loading = "lazy";
        category.textContent = project.category || "Graphic Design";
        title.textContent = project.title;
        description.textContent = project.description || "No description added for this project yet.";
        date.innerHTML = `<i class="fa-regular fa-calendar-alt"></i> ${formatDate(getDisplayDate(project))}`;
        deleteButton.hidden = !isOwnerAuthenticated;
        
        deleteButton.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteProject(project.id);
        });
        
        viewButton.addEventListener("click", (e) => {
            e.stopPropagation();
            openDetailModal(project);
        });
        
        card.addEventListener("click", () => openDetailModal(project));
        
        galleryContainer.appendChild(fragment);
    });
}

// Filter Projects
function filterProjects() {
    if (currentFilter === "all") {
        renderProjects(currentProjects);
    } else {
        const filtered = currentProjects.filter(p => p.category === currentFilter);
        renderProjects(filtered);
    }
}

// Fetch Projects
async function fetchProjects() {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error("Could not load projects.");
        
        const payload = await response.json();
        currentProjects = payload.projects || [];
        filterProjects();
    } catch (error) {
        galleryContainer.innerHTML = `<div class="empty-state">
            <i class="fa-solid fa-server" style="font-size: 3rem; margin-bottom: var(--space-md);"></i>
            <p>Backend is not reachable. Please start the server.</p>
        </div>`;
        showToast(error.message || "Failed to load projects.", "error");
    }
}

// Delete Project
async function deleteProject(projectId) {
    if (!isOwnerAuthenticated || !ownerToken) {
        openLoginModal();
        return;
    }

    const confirmed = confirm("Are you sure you want to delete this project? This action cannot be undone.");
    if (!confirmed) return;
    
    try {
        const response = await fetch(`${API_BASE}/${projectId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${ownerToken}`
            }
        });
        const payload = await response.json();
        
        if (response.status === 401) {
            clearOwnerAuth(true);
            return;
        }

        if (!response.ok) throw new Error(payload.error || "Could not delete project.");
        
        showToast(payload.message || "Project deleted successfully.");
        fetchProjects();
    } catch (error) {
        showToast(error.message || "Delete failed.", "error");
    }
}

// Image Preview
function handleFileSelect(file) {
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
        showToast("Only image files are allowed.", "error");
        selectedFile = null;
        fileNameDisplay.textContent = "Please choose an image file.";
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showToast("File size must be less than 10MB.", "error");
        selectedFile = null;
        fileNameDisplay.textContent = "File too large (max 10MB).";
        return;
    }
    
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    
    // Preview image
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        imagePreview.style.display = "block";
        dropArea.querySelector(".dropzone-content").style.display = "none";
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedFile = null;
    imagePreview.style.display = "none";
    previewImg.src = "";
    dropArea.querySelector(".dropzone-content").style.display = "flex";
    fileInput.value = "";
    fileNameDisplay.textContent = "PNG, JPG, WEBP, or GIF (Max 10MB)";
}

// Upload Project
function uploadProject(event) {
    event.preventDefault();

    if (!isOwnerAuthenticated || !ownerToken) {
        openLoginModal();
        return;
    }
    
    const title = titleInput.value.trim();
    const projectDate = projectDateInput?.value;
    if (!title) {
        showToast("Project title is required.", "error");
        return;
    }

    if (!projectDate) {
        showToast("Please choose the project date.", "error");
        return;
    }
    
    if (!selectedFile) {
        showToast("Please choose an image before uploading.", "error");
        return;
    }
    
    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", categoryInput.value.trim() || "Uncategorized");
    formData.append("description", descriptionInput.value.trim());
    formData.append("projectDate", projectDate);
    formData.append("file", selectedFile);
    
    submitUploadBtn.disabled = true;
    uploadProgress.style.display = "block";
    progressFill.style.width = "0%";
    if (progressPercent) progressPercent.textContent = "0%";
    
    const request = new XMLHttpRequest();
    request.open("POST", API_BASE, true);
    request.setRequestHeader("Authorization", `Bearer ${ownerToken}`);
    
    request.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = `${percent}%`;
            if (progressPercent) progressPercent.textContent = `${percent}%`;
        }
    });
    
    request.onload = () => {
        submitUploadBtn.disabled = false;
        
        let payload = {};
        try {
            payload = JSON.parse(request.responseText);
        } catch (e) {
            payload = {};
        }
        
        if (request.status === 401) {
            clearOwnerAuth(true);
            return;
        }

        if (request.status >= 200 && request.status < 300) {
            showToast(payload.message || "Project uploaded successfully!");
            closeModal();
            fetchProjects();
        } else {
            uploadProgress.style.display = "none";
            progressFill.style.width = "0%";
            if (progressPercent) progressPercent.textContent = "0%";
            showToast(payload.error || "Upload failed. Please try again.", "error");
        }
    };
    
    request.onerror = () => {
        submitUploadBtn.disabled = false;
        uploadProgress.style.display = "none";
        progressFill.style.width = "0%";
        if (progressPercent) progressPercent.textContent = "0%";
        showToast("Network error while uploading.", "error");
    };
    
    request.send(formData);
}

// Event Listeners
dropArea.addEventListener("click", () => fileInput.click());
dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("is-dragover");
});
dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("is-dragover");
});
dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("is-dragover");
    if (e.dataTransfer?.files?.length) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener("change", (e) => {
    if (e.target.files?.length) {
        handleFileSelect(e.target.files[0]);
    }
});

removeImageBtn?.addEventListener("click", removeImage);

ownerLoginBtn?.addEventListener("click", () => openLoginModal());
heroOwnerBtn?.addEventListener("click", () => openLoginModal());
ownerLogoutBtn?.addEventListener("click", () => {
    clearOwnerAuth();
    showToast("Owner logged out.");
});
openUploadBtn?.addEventListener("click", openModal);
if (heroUploadBtn) heroUploadBtn.addEventListener("click", openModal);
closeLoginModalBtn?.addEventListener("click", closeLoginModal);
cancelLoginBtn?.addEventListener("click", closeLoginModal);
loginModal?.addEventListener("click", (e) => {
    if (e.target === loginModal) closeLoginModal();
});
detailModal?.addEventListener("click", (e) => {
    if (e.target === detailModal) closeDetailModal();
});
closeModalBtn.addEventListener("click", closeModal);
cancelUploadBtn.addEventListener("click", closeModal);
uploadModal.addEventListener("click", (e) => {
    if (e.target === uploadModal) closeModal();
});
loginForm?.addEventListener("submit", loginOwner);
uploadForm.addEventListener("submit", uploadProject);

// Filter tabs
if (filterTabs) {
    filterTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".filter-btn");
        if (!btn) return;
        
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        filterProjects();
    });
}

// Active nav link on scroll
window.addEventListener("scroll", () => {
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll(".nav-link");
    
    let current = "";
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= sectionTop - 200) {
            current = section.getAttribute("id");
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove("active");
        if (link.getAttribute("href") === `#${current}`) {
            link.classList.add("active");
        }
    });
});

// Initialize
if (projectDateInput) {
    projectDateInput.value = new Date().toISOString().split("T")[0];
}

updateOwnerUI();
validateStoredOwnerSession();
fetchProjects();
