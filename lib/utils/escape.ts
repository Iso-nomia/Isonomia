export function escapeHtml(str = "") {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  
  export function escapeJSX(str = "") {
    return str
      .replace(/&/g, "&amp;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/{/g, "&#123;")
      .replace(/}/g, "&#125;");
  }
  
  /* optional: CSS‑in‑JS helper */
  export const camelToKebab = (k: string) =>
    k.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
  