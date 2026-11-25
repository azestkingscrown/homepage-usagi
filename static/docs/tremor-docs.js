(function () {
  "use strict";

  // 1. Theme Sync (compatible with localStorage key "theme")
  function getStoredTheme() {
    try {
      return localStorage.getItem("theme") || "system";
    } catch {
      return "system";
    }
  }

  function applyTheme(theme) {
    var prefersDark = Boolean(
      window.matchMedia?.("(prefers-color-scheme: dark)").matches,
    );
    var isDark = theme === "dark" || (theme === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);

    var labelMap = {
      dark: "Dark",
      light: "Light",
      system: "Auto",
    };
    var isKo = document.documentElement.lang === "ko";
    var label = labelMap[theme] || "Auto";
    var titlePrefix = isKo ? "테마 전환 (현재: " : "Toggle theme (current: ";
    var buttons = document.querySelectorAll("[data-theme-toggle]");
    buttons.forEach(function (btn) {
      btn.textContent = label;
      btn.setAttribute("title", titlePrefix + label + ")");
    });
  }

  function getSharedCookieDomain(hostname) {
    var baseHost = hostname.replace(/^(?:www|chzzk)\./i, "");
    if (
      !baseHost ||
      baseHost === "localhost" ||
      /^\d+\.\d+\.\d+\.\d+$/.test(baseHost) ||
      !baseHost.includes(".")
    ) {
      return "";
    }
    return "; Domain=." + baseHost;
  }

  function switchLanguage() {
    var current = document.documentElement.lang === "ko" ? "ko" : "en";
    var next = current === "ko" ? "en" : "ko";
    var domain = getSharedCookieDomain(window.location.hostname);
    var secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      "azest_lang=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax" + domain + secure;
    try {
      localStorage.setItem("lang", next);
    } catch {
      // storage access blocked
    }
    window.location.reload();
  }

  function getNextTheme(current) {
    if (current === "dark") return "light";
    if (current === "light") return "system";
    return "dark";
  }

  function cycleTheme() {
    var next = getNextTheme(getStoredTheme());
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage access blocked
    }
    applyTheme(next);
  }

  applyTheme(getStoredTheme());

  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function () {
        if (getStoredTheme() === "system") {
          applyTheme("system");
        }
      });
  }

  // 2. Smart Route Resolution (chzzk subdomain vs main domain)
  function resolveRouteUrls() {
    var host = window.location.host || "example.com";
    var protocol = window.location.protocol || "https:";
    var isChzzkSub = /^chzzk\./i.test(host);

    var baseHost = host.replace(/^www\./i, "").replace(/^chzzk\./i, "");
    var mainOrigin = isChzzkSub ? protocol + "//" + baseHost : "";

    var map = isChzzkSub
      ? {
          home: mainOrigin + "/",
          guide: "/guide",
          update: "/update",
          tech: "/tech",
          ddns: mainOrigin + "/ddns",
          minecraft: mainOrigin + "/minecraft",
          hosting: mainOrigin + "/hosting",
          admin: mainOrigin + "/admin",
        }
      : {
          home: "/",
          guide: "/chzzk-bot-guide",
          update: "/chzzk-bot-update",
          tech: "/technical-info",
          ddns: "/ddns",
          minecraft: "/minecraft",
          hosting: "/hosting",
          admin: "/admin",
        };

    document.querySelectorAll("[data-route]").forEach(function (el) {
      var key = el.dataset.route;
      if (key && map[key]) {
        el.setAttribute("href", map[key]);
      }
    });
  }

  // 3. Mobile Drawer
  function initDrawer() {
    var openBtn = document.getElementById("mobileMenuOpen");
    var closeBtn = document.getElementById("mobileMenuClose");
    var overlay = document.getElementById("mobileDrawer");

    if (!overlay) return;

    function openDrawer() {
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }

    if (openBtn) openBtn.addEventListener("click", openDrawer);
    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeDrawer();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  }

  // 4. Lightbox Viewer
  function initLightbox() {
    var viewer = document.getElementById("imageViewer");
    var viewerImg = document.getElementById("viewerImage");
    var caption = document.getElementById("viewerCaption");
    var closeBtn = document.getElementById("viewerClose");

    if (!viewer || !viewerImg) return;

    function openViewer(src, alt) {
      viewerImg.src = src;
      if (caption) caption.textContent = alt || "";
      viewer.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    function closeViewer() {
      viewer.classList.remove("active");
      document.body.style.overflow = "";
    }

    document.querySelectorAll(".doc-img").forEach(function (img) {
      img.addEventListener("click", function () {
        openViewer(img.src, img.alt || img.dataset.caption || "");
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeViewer();
      });
    }

    viewer.addEventListener("click", function () {
      closeViewer();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeViewer();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(getStoredTheme());
    resolveRouteUrls();
    initDrawer();
    initLightbox();

    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", cycleTheme);
    });

    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      btn.addEventListener("click", switchLanguage);
    });
  });
})();
