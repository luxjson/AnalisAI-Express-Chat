(function () {
  const iconMap = {
    "arrow-left": "arrow-left",
    "arrow-trend-up": "trend-up",
    "arrow-up": "arrow-up",
    bars: "list",
    bell: "bell",
    book: "book",
    "book-open": "book-open",
    briefcase: "briefcase",
    bullseye: "target",
    calendar: "calendar",
    "calendar-alt": "calendar",
    "calendar-check": "calendar-check",
    "calendar-day": "calendar-blank",
    "calendar-times": "calendar-x",
    certificate: "certificate",
    "chart-bar": "chart-bar",
    "chart-line": "chart-line",
    "chart-pie": "chart-pie",
    check: "check",
    "check-circle": "check-circle",
    "check-double": "checks",
    "chevron-left": "caret-left",
    "chevron-right": "caret-right",
    "circle-notch": "circle-notch",
    "clipboard-check": "clipboard",
    "clipboard-list": "clipboard-text",
    clock: "clock",
    "clock-rotate-left": "clock-counter-clockwise",
    "cloud-upload-alt": "cloud-arrow-up",
    cog: "gear",
    "comment-dots": "chat-circle-dots",
    comments: "chats",
    copy: "copy",
    database: "database",
    download: "download-simple",
    envelope: "envelope",
    "exclamation-circle": "warning-circle",
    "exclamation-triangle": "warning",
    eye: "eye",
    "file-export": "file-arrow-up",
    "file-import": "file-arrow-down",
    "file-upload": "file-arrow-up",
    file: "file",
    "file-download": "file-arrow-down",
    filter: "funnel",
    "graduation-cap": "graduation-cap",
    hashtag: "hash",
    home: "house",
    "hourglass-half": "hourglass-medium",
    inbox: "tray",
    "info-circle": "info",
    "id-card": "identification-card",
    key: "key",
    lock: "lock",
    "layer-group": "stack",
    lightbulb: "lightbulb",
    "list-check": "list-checks",
    "list-ul": "list-bullets",
    medal: "medal",
    message: "chat",
    "paper-plane": "paper-plane-tilt",
    paperclip: "paperclip",
    pen: "pen",
    "pencil-alt": "pencil-simple",
    plus: "plus",
    "question-circle": "question",
    "quote-left": "quotes",
    "quote-right": "quotes",
    save: "floppy-disk",
    search: "magnifying-glass",
    "shield-alt": "shield-check",
    "sign-in-alt": "sign-in",
    "sign-out-alt": "sign-out",
    spinner: "spinner",
    star: "star",
    stream: "list",
    sync: "arrows-clockwise",
    "sync-alt": "arrows-clockwise",
    tag: "tag",
    tasks: "check-square",
    terminal: "terminal-window",
    times: "x",
    "times-circle": "x-circle",
    "triangle-exclamation": "warning",
    trophy: "trophy",
    thumbtack: "push-pin",
    trash: "trash",
    "undo-alt": "arrow-u-up-left",
    university: "buildings",
    user: "user",
    "user-check": "user-check",
    "user-edit": "user-gear",
    "user-plus": "user-plus",
    users: "users",
    "wand-magic-sparkles": "sparkle",
  };

  function migrateIcons() {
    document.querySelectorAll('i[class*="fa-"]').forEach((icon) => {
      const oldName = Array.from(icon.classList).find(
        (className) =>
          className.indexOf("fa-") === 0 && iconMap[className.slice(3)],
      );
      const phosphorName = oldName && iconMap[oldName.slice(3)];
      if (!phosphorName) {
        const hasBellSlash = icon.classList.contains("fa-bell-slash");
        if (hasBellSlash) {
          icon.className = "ph-bold ph-bell-slash";
          icon.setAttribute("aria-hidden", "true");
        }
        return;
      }

      const isSpinning = icon.classList.contains("fa-spin");
      icon.className = `ph-bold ph-${phosphorName}${isSpinning ? " ph-spin" : ""}`;
      icon.setAttribute("aria-hidden", "true");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", migrateIcons, { once: true });
  } else {
    migrateIcons();
  }

  new MutationObserver(migrateIcons).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
