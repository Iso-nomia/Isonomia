/**
 * Mesh Widget Embed Script
 *
 * Client-side script for dynamically loading Mesh widgets.
 * Usage:
 *   <div class="mesh-widget" data-mesh-type="stack" data-mesh-id="abc123"></div>
 *   <script src="https://mesh.app/embed.js" async></script>
 *
 * Supported data attributes:
 *   - data-mesh-type: "stack" | "evidence" | "source" | "health"
 *   - data-mesh-id: The ID of the target
 *   - data-mesh-theme: "light" | "dark" | "auto" (default: auto)
 *   - data-mesh-compact: "true" | "false" (default: false)
 *   - data-mesh-width: Width in pixels (optional)
 */

(function () {
  "use strict";

  const MESH_BASE_URL = "https://mesh.app";
  const WIDGET_CLASS = "mesh-widget";
  const PROCESSED_ATTR = "data-mesh-processed";

  // Default heights for each widget type
  const WIDGET_HEIGHTS = {
    stack: 400,
    evidence: 500,
    source: 150,
    health: 60,
  };

  // Default widths for each widget type
  const WIDGET_WIDTHS = {
    stack: 600,
    evidence: 500,
    source: 400,
    health: 150,
  };

  /**
   * Initialize all mesh widgets on the page
   */
  function initWidgets() {
    const widgets = document.querySelectorAll(
      `.${WIDGET_CLASS}:not([${PROCESSED_ATTR}])`
    );

    widgets.forEach(function (widget) {
      processWidget(widget);
    });
  }

  /**
   * Process a single widget element
   */
  function processWidget(element) {
    const type = element.getAttribute("data-mesh-type");
    const id = element.getAttribute("data-mesh-id");
    const theme = element.getAttribute("data-mesh-theme") || "auto";
    const compact = element.getAttribute("data-mesh-compact") === "true";
    const customWidth = element.getAttribute("data-mesh-width");

    if (!type || !id) {
      console.warn("[Mesh] Missing data-mesh-type or data-mesh-id", element);
      return;
    }

    if (!["stack", "evidence", "source", "health"].includes(type)) {
      console.warn("[Mesh] Invalid widget type:", type);
      return;
    }

    // Mark as processed
    element.setAttribute(PROCESSED_ATTR, "true");

    // Build embed URL
    const params = new URLSearchParams();
    if (theme !== "auto") params.set("theme", theme);
    if (compact) params.set("compact", "true");
    if (customWidth) params.set("width", customWidth);

    const embedUrl =
      MESH_BASE_URL +
      "/embed/" +
      type +
      "/" +
      id +
      (params.toString() ? "?" + params.toString() : "");

    // Determine dimensions
    const width = customWidth
      ? parseInt(customWidth, 10)
      : WIDGET_WIDTHS[type] || 400;
    const height = WIDGET_HEIGHTS[type] || 300;

    // Create iframe
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.width = "100%";
    iframe.style.maxWidth = width + "px";
    iframe.height = height + "px";
    iframe.frameBorder = "0";
    iframe.style.border = "1px solid #e5e7eb";
    iframe.style.borderRadius = "8px";
    iframe.style.display = "block";
    iframe.title = "Mesh " + type + " widget";
    iframe.loading = "lazy";
    iframe.allow = "clipboard-write";

    // Handle responsive sizing for stacks and evidence
    if (type === "stack" || type === "evidence") {
      iframe.style.minHeight = "200px";
    }

    // Clear any existing content and append iframe
    element.innerHTML = "";
    element.appendChild(iframe);

    // Set up message listener for dynamic height adjustment
    setupResizeListener(iframe, element);
  }

  /**
   * Listen for resize messages from the embedded widget
   */
  function setupResizeListener(iframe, container) {
    window.addEventListener("message", function (event) {
      // Verify origin
      if (!event.origin.includes("mesh.app") && event.origin !== window.location.origin) {
        return;
      }

      try {
        const data = event.data;
        if (
          data &&
          data.type === "mesh-widget-resize" &&
          data.widgetId &&
          iframe.src.includes(data.widgetId)
        ) {
          iframe.height = data.height + "px";
        }
      } catch (e) {
        // Ignore parse errors from other message sources
      }
    });
  }

  /**
   * Watch for dynamically added widgets
   */
  function setupMutationObserver() {
    if (typeof MutationObserver === "undefined") {
      return;
    }

    const observer = new MutationObserver(function (mutations) {
      let hasNewWidgets = false;

      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (
              node.classList &&
              node.classList.contains(WIDGET_CLASS) &&
              !node.hasAttribute(PROCESSED_ATTR)
            ) {
              hasNewWidgets = true;
            }
            // Also check children
            if (node.querySelectorAll) {
              const children = node.querySelectorAll(
                `.${WIDGET_CLASS}:not([${PROCESSED_ATTR}])`
              );
              if (children.length > 0) {
                hasNewWidgets = true;
              }
            }
          }
        });
      });

      if (hasNewWidgets) {
        initWidgets();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Initialize when DOM is ready
   */
  function init() {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      initWidgets();
      setupMutationObserver();
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        initWidgets();
        setupMutationObserver();
      });
    }
  }

  // Start initialization
  init();

  // Expose API for programmatic use
  window.MeshWidgets = {
    init: initWidgets,
    refresh: function () {
      // Remove processed markers and re-init
      document
        .querySelectorAll(`[${PROCESSED_ATTR}]`)
        .forEach(function (el) {
          el.removeAttribute(PROCESSED_ATTR);
        });
      initWidgets();
    },
  };
})();
