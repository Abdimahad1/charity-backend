// keep base64, http(s), and existing /uploads paths as-is
function normalizeImage(input = "") {
    const s = String(input || "");
    if (!s) return "";
    if (/^data:/i.test(s)) return s;                 // <-- critical
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/uploads/")) return s;
  
    // bare filename or images/...
    const clean = s.replace(/^\/+/, "").replace(/^images\//, "");
    return `/uploads/images/${clean}`;
  }
  module.exports = { normalizeImage };
  