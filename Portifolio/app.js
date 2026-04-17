// API Configuration - Local server on port 4000
const API_BASE = "https://myportifolio-2ovw.onrender.com/api/projects";
const OWNER_LOGIN_API =
    "https://myportifolio-2ovw.onrender.com/api/owner/login";
const OWNER_SESSION_API =
    "https://myportifolio-2ovw.onrender.com/api/owner/session";
const OWNER_TOKEN_STORAGE_KEY = "devPortfolioToken";

let currentProjects = [];
let ownerToken = localStorage.getItem(OWNER_TOKEN_STORAGE_KEY) || "";
let isOwnerAuthenticated = false;
let selectedFile = null;
const galleryContainer = document.getElementById("galleryContainer");
const cardTemplate = document.getElementById("projectCardTemplate");

// Mobile Menu Functions
function openMobileMenu() {
    const mobileNav = document.getElementById("mobileNavLinks");
    const overlay = document.getElementById("mobileMenuOverlay");
    mobileNav.classList.add("active");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeMobileMenu() {
    const mobileNav = document.getElementById("mobileNavLinks");
    const overlay = document.getElementById("mobileMenuOverlay");
    mobileNav.classList.remove("active");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
}

function syncMobileMenuWithAuth() {
    const mobileOpenUploadBtn = document.getElementById(
        "mobileOpenUploadBtn",
    );
    const mobileOwnerLogoutBtn = document.getElementById(
        "mobileOwnerLogoutBtn",
    );
    const mobileOwnerLoginBtn = document.getElementById(
        "mobileOwnerLoginBtn",
    );

    if (mobileOpenUploadBtn) {
        mobileOpenUploadBtn.style.display = isOwnerAuthenticated
            ? "inline-flex"
            : "none";
    }
    if (mobileOwnerLogoutBtn) {
        mobileOwnerLogoutBtn.style.display = isOwnerAuthenticated
            ? "inline-flex"
            : "none";
    }
    if (mobileOwnerLoginBtn) {
        mobileOwnerLoginBtn.style.display = isOwnerAuthenticated
            ? "none"
            : "inline-flex";
    }
}

function showToast(msg, type = "success") {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerText = msg;
    document.getElementById("toastContainer").appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return "Recent";
    return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

async function validateSession() {
    if (!ownerToken) {
        isOwnerAuthenticated = false;
        updateOwnerUI();
        syncMobileMenuWithAuth();
        return false;
    }

    try {
        const response = await fetch(OWNER_SESSION_API, {
            headers: {
                Authorization: `Bearer ${ownerToken}`,
            },
        });
        const data = await response.json();
        isOwnerAuthenticated = data.authenticated === true;

        if (!isOwnerAuthenticated) {
            ownerToken = "";
            localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
        }

        updateOwnerUI();
        syncMobileMenuWithAuth();
        return isOwnerAuthenticated;
    } catch (error) {
        console.error("Session validation error:", error);
        isOwnerAuthenticated = false;
        updateOwnerUI();
        syncMobileMenuWithAuth();
        return false;
    }
}

async function fetchProjects() {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error("Failed to fetch projects");

        const data = await response.json();
        currentProjects = data.projects || [];

        const projectCountEl = document.getElementById("projectCount");
        if (projectCountEl) {
            projectCountEl.textContent = currentProjects.length;
        }

        renderProjects(currentProjects);
    } catch (error) {
        console.error("Error fetching projects:", error);
        galleryContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-server"></i><p>Unable to connect to server. Please make sure the backend is running on port 4000.</p></div>`;
        showToast("Failed to load projects from server", "error");
    }
}

function renderProjects(projects) {
    if (!projects.length) {
        galleryContainer.innerHTML = `<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No projects yet. Add your first project using the Owner panel.</p></div>`;
        return;
    }

    galleryContainer.innerHTML = "";
    projects.forEach((proj) => {
        const clone = cardTemplate.content.cloneNode(true);
        const card = clone.querySelector(".project-card");
        card.querySelector(".project-image").src = proj.imageUrl;
        card.querySelector(".project-category").innerText =
            proj.category || "Fullstack App";
        card.querySelector(".project-title").innerText = proj.title;
        card.querySelector(".project-description").innerText =
            proj.description?.slice(0, 100) ||
            "Full-stack solution with real impact.";

        const linksContainer = card.querySelector(".project-links");
        linksContainer.innerHTML = "";

        if (proj.liveUrl) {
            linksContainer.innerHTML += `<a href="${proj.liveUrl}" target="_blank" class="project-link" onclick="event.stopPropagation()"><i class="fa-solid fa-globe"></i> Live Demo</a>`;
        }
        if (proj.githubUrl) {
            linksContainer.innerHTML += `<a href="${proj.githubUrl}" target="_blank" class="project-link" onclick="event.stopPropagation()"><i class="fa-brands fa-github"></i> Source Code</a>`;
        }

        card.querySelector(".project-date").innerHTML =
            `<i class="fa-regular fa-calendar"></i> ${formatDate(proj.projectDate)}`;

        const delBtn = card.querySelector(".delete-project-btn");
        if (delBtn) {
            delBtn.style.display = isOwnerAuthenticated
                ? "inline-flex"
                : "none";
        }

        card.addEventListener("click", (e) => {
            if (
                !e.target.closest(".delete-project-btn") &&
                !e.target.closest(".project-link")
            )
                openDetailModal(proj);
        });

        delBtn?.addEventListener("click", async (e) => {
            e.stopPropagation();
            await deleteProject(proj.id);
        });

        galleryContainer.appendChild(clone);
    });
}

async function deleteProject(id) {
    if (!isOwnerAuthenticated) {
        openLoginModal();
        return;
    }

    if (
        !confirm(
            "Permanently delete this project? This action cannot be undone.",
        )
    ) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${ownerToken}`,
            },
        });

        if (response.status === 401) {
            showToast("Session expired. Please login again.", "error");
            await validateSession();
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete project");
        }

        showToast("Project deleted successfully!");
        await fetchProjects();
    } catch (error) {
        console.error("Error deleting project:", error);
        showToast(error.message || "Failed to delete project", "error");
    }
}

function openDetailModal(proj) {
    const detailDiv = document.getElementById("detailContent");
    detailDiv.innerHTML = `
          <div class="modal-header">
            <h3>${escapeHtml(proj.title)}</h3>
            <button id="closeDetailBtn" class="modal-close">&times;</button>
          </div>
          <img src="${proj.imageUrl}" style="width:100%; border-radius:var(--radius-md); margin:1rem 0">
          <p><strong>Category:</strong> ${escapeHtml(proj.category || "Fullstack App")}</p>
          <p>${escapeHtml(proj.description || "Real-world fullstack application with focus on scalability and efficiency.")}</p>
          <div style="display:flex; gap:1rem; margin:1rem 0">
            ${proj.liveUrl ? `<a href="${proj.liveUrl}" target="_blank" class="btn-primary"><i class="fa-solid fa-globe"></i> Live Demo</a>` : ""}
            ${proj.githubUrl ? `<a href="${proj.githubUrl}" target="_blank" class="btn-secondary"><i class="fa-brands fa-github"></i> GitHub</a>` : ""}
          </div>
          <p><i class="fa-regular fa-calendar"></i> ${formatDate(proj.projectDate)}</p>
        `;
    document.getElementById("detailModal").classList.add("is-open");
    document.getElementById("closeDetailBtn").onclick = () =>
        document.getElementById("detailModal").classList.remove("is-open");
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, function (m) {
        if (m === "&") return "&amp;";
        if (m === "<") return "&lt;";
        if (m === ">") return "&gt;";
        return m;
    });
}

async function loginOwner(e) {
    e.preventDefault();
    const password = document.getElementById("ownerPassword").value;

    if (!password) {
        showToast("Please enter the owner password", "error");
        return;
    }

    try {
        const response = await fetch(OWNER_LOGIN_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Login failed");
        }

        ownerToken = data.token;
        localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, ownerToken);
        isOwnerAuthenticated = true;
        updateOwnerUI();
        syncMobileMenuWithAuth();
        closeLoginModal();
        showToast(data.message || "Login successful!");

        await fetchProjects();
    } catch (error) {
        console.error("Login error:", error);
        showToast(error.message || "Invalid password", "error");
    }
}

function updateOwnerUI() {
    const openUploadBtn = document.getElementById("openUploadBtn");
    const ownerLogoutBtn = document.getElementById("ownerLogoutBtn");
    const ownerLoginBtn = document.getElementById("ownerLoginBtn");

    if (openUploadBtn) {
        openUploadBtn.style.display = isOwnerAuthenticated
            ? "inline-flex"
            : "none";
    }
    if (ownerLogoutBtn) {
        ownerLogoutBtn.style.display = isOwnerAuthenticated
            ? "inline-flex"
            : "none";
    }
    if (ownerLoginBtn) {
        ownerLoginBtn.style.display = isOwnerAuthenticated
            ? "none"
            : "inline-flex";
    }

    const deleteBtns = document.querySelectorAll(".delete-project-btn");
    deleteBtns.forEach((btn) => {
        btn.style.display = isOwnerAuthenticated ? "inline-flex" : "none";
    });
}

function clearOwnerAuth() {
    ownerToken = "";
    isOwnerAuthenticated = false;
    localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
    updateOwnerUI();
    syncMobileMenuWithAuth();
    showToast("Logged out successfully.");
    fetchProjects();
}

function openLoginModal() {
    closeMobileMenu();
    document.getElementById("loginModal").classList.add("is-open");
}

function closeLoginModal() {
    document.getElementById("loginModal").classList.remove("is-open");
    document.getElementById("loginForm").reset();
}

function openUploadModal() {
    if (!isOwnerAuthenticated) {
        openLoginModal();
        return;
    }
    closeMobileMenu();
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("projectDate").value = today;
    document.getElementById("uploadModal").classList.add("is-open");
}

function closeUploadModal() {
    document.getElementById("uploadModal").classList.remove("is-open");
    resetUploadForm();
}

function resetUploadForm() {
    document.getElementById("uploadForm").reset();
    selectedFile = null;
    document.getElementById("imagePreview").style.display = "none";
    document.getElementById("previewImg").src = "";
    document.getElementById("uploadProgress").style.display = "none";
    const dropzoneContent = document.querySelector(
        "#dropArea .dropzone-content",
    );
    if (dropzoneContent) dropzoneContent.style.display = "block";
}

function handleFileSelect(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        showToast("Only images are allowed", "error");
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast("File size must be less than 10MB", "error");
        return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById("previewImg").src = e.target.result;
        document.getElementById("imagePreview").style.display = "block";
        const dropzoneContent = document.querySelector(
            "#dropArea .dropzone-content",
        );
        if (dropzoneContent) dropzoneContent.style.display = "none";
    };
    reader.readAsDataURL(file);
}

async function uploadProjectHandler(e) {
    e.preventDefault();

    if (!isOwnerAuthenticated) {
        openLoginModal();
        return;
    }
    const githubUrl = document.getElementById("githubUrl").value.trim();
    if (
        githubUrl &&
        !/^https?:\/\/(www\.)?github\.com\/.+/.test(githubUrl)
    ) {
        showToast("Please enter a valid GitHub URL", "error");
        return;
    }
    const liveUrl = document.getElementById("liveUrl").value.trim();
    if (liveUrl && !/^https?:\/\/.+/.test(liveUrl)) {
        showToast("Please enter a valid Live URL", "error");
        return;
    }
    const title = document.getElementById("title").value.trim();
    if (!title) {
        showToast("Project title is required", "error");
        return;
    }
    console.log(githubUrl, liveUrl);
    const projectDate = document.getElementById("projectDate").value;
    if (!projectDate) {
        showToast("Project date is required", "error");
        return;
    }

    if (!selectedFile) {
        showToast("Please select an image for the project", "error");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append(
        "category",
        document.getElementById("category").value || "Fullstack App",
    );
    formData.append(
        "description",
        document.getElementById("description").value.trim() || "",
    );
    formData.append("projectDate", projectDate);
    formData.append("file", selectedFile);
    formData.append("liveUrl", liveUrl);
    formData.append("githubUrl", githubUrl);

    const submitBtn = document.querySelector(
        "#uploadForm button[type='submit']",
    );
    submitBtn.disabled = true;
    document.getElementById("uploadProgress").style.display = "block";

    try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", API_BASE, true);
        xhr.setRequestHeader("Authorization", `Bearer ${ownerToken}`);

        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                const progressFill = document.getElementById("progressFill");
                if (progressFill) progressFill.style.width = `${percent}%`;
            }
        });

        xhr.onload = async () => {
            submitBtn.disabled = false;
            document.getElementById("uploadProgress").style.display = "none";

            if (xhr.status === 401) {
                showToast("Session expired. Please login again.", "error");
                await validateSession();
                return;
            }

            if (xhr.status >= 200 && xhr.status < 300) {
                const data = JSON.parse(xhr.responseText);
                showToast(data.message || "Project uploaded successfully!");
                closeUploadModal();
                await fetchProjects();
            } else {
                const error = JSON.parse(xhr.responseText);
                showToast(error.error || "Upload failed", "error");
            }
        };

        xhr.onerror = () => {
            submitBtn.disabled = false;
            document.getElementById("uploadProgress").style.display = "none";
            showToast("Network error while uploading", "error");
        };

        xhr.send(formData);
    } catch (error) {
        submitBtn.disabled = false;
        document.getElementById("uploadProgress").style.display = "none";
        showToast("Error uploading project", "error");
    }
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector("#themeToggle i");
    if (themeIcon) {
        themeIcon.className =
            theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }
    const mobileThemeIcon = document.querySelector("#mobileThemeToggle i");
    if (mobileThemeIcon) {
        mobileThemeIcon.className =
            theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }
}

function toggleTheme() {
    const currentTheme =
        document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(newTheme);
}

// Event listeners
const ownerLoginBtn = document.getElementById("ownerLoginBtn"),
    openUploadBtn = document.getElementById("openUploadBtn"),
    ownerLogoutBtn = document.getElementById("ownerLogoutBtn");

ownerLoginBtn?.addEventListener("click", openLoginModal);
openUploadBtn?.addEventListener("click", openUploadModal);
ownerLogoutBtn?.addEventListener("click", clearOwnerAuth);

// Mobile menu event listeners
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const closeMobileMenuBtn = document.getElementById("closeMobileMenuBtn");
const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");

mobileMenuBtn?.addEventListener("click", openMobileMenu);
closeMobileMenuBtn?.addEventListener("click", closeMobileMenu);
mobileMenuOverlay?.addEventListener("click", closeMobileMenu);

// Mobile menu link clicks
document.querySelectorAll("[data-mobile='true']").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href) {
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: "smooth" });
            }
        }
        closeMobileMenu();
    });
});

// Mobile theme toggle
const mobileThemeToggle = document.getElementById("mobileThemeToggle");
mobileThemeToggle?.addEventListener("click", () => {
    toggleTheme();
    closeMobileMenu();
});

// Mobile auth buttons
const mobileOwnerLoginBtn = document.getElementById(
    "mobileOwnerLoginBtn",
);
const mobileOpenUploadBtn = document.getElementById(
    "mobileOpenUploadBtn",
);
const mobileOwnerLogoutBtn = document.getElementById(
    "mobileOwnerLogoutBtn",
);

mobileOwnerLoginBtn?.addEventListener("click", () => {
    openLoginModal();
    closeMobileMenu();
});
mobileOpenUploadBtn?.addEventListener("click", () => {
    openUploadModal();
    closeMobileMenu();
});
mobileOwnerLogoutBtn?.addEventListener("click", () => {
    clearOwnerAuth();
    closeMobileMenu();
});

document
    .getElementById("loginForm")
    ?.addEventListener("submit", loginOwner);
document
    .getElementById("cancelLoginBtn")
    ?.addEventListener("click", closeLoginModal);
document
    .getElementById("closeLoginModalBtn")
    ?.addEventListener("click", closeLoginModal);
document
    .getElementById("uploadForm")
    ?.addEventListener("submit", uploadProjectHandler);
document
    .getElementById("closeModalBtn")
    ?.addEventListener("click", closeUploadModal);
document
    .getElementById("cancelUploadBtn")
    ?.addEventListener("click", closeUploadModal);
document
    .getElementById("contactScroll")
    ?.addEventListener("click", () =>
        document
            .getElementById("about")
            .scrollIntoView({ behavior: "smooth" }),
    );
document
    .getElementById("themeToggle")
    ?.addEventListener("click", toggleTheme);

document.querySelectorAll(".modal-overlay").forEach((overlay) =>
    overlay.addEventListener("click", () => {
        document
            .querySelectorAll(".modal")
            .forEach((m) => m.classList.remove("is-open"));
    }),
);

const dropArea = document.getElementById("dropArea");
const fileInput = document.getElementById("fileInput");

dropArea?.addEventListener("click", () => fileInput.click());
dropArea?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.style.borderColor = "var(--primary)";
});
dropArea?.addEventListener("dragleave", () => {
    dropArea.style.borderColor = "var(--border-color)";
});
dropArea?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.style.borderColor = "var(--border-color)";
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
});

fileInput?.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFileSelect(e.target.files[0]);
});

document
    .getElementById("removeImageBtn")
    ?.addEventListener("click", () => {
        selectedFile = null;
        document.getElementById("imagePreview").style.display = "none";
        const dropzoneContent = document.querySelector(
            "#dropArea .dropzone-content",
        );
        if (dropzoneContent) dropzoneContent.style.display = "block";
        fileInput.value = "";
    });

// Initialize
AOS.init({ duration: 800, once: true });
initTheme();

window.addEventListener("load", async () => {
    setTimeout(() => {
        document.getElementById("loader")?.classList.add("fade-out");
        setTimeout(() => document.getElementById("loader")?.remove(), 500);
    }, 400);

    await validateSession();
    await fetchProjects();
});

window.addEventListener("scroll", () => {
    const nav = document.getElementById("navbar");
    if (window.scrollY > 50) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
});
