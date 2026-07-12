/**
 * File Export Utilities
 * Helper functions for downloading generated content as files
 */

/**
 * Download content as a file using Blob API
 * 
 * @param content - The text content to download
 * @param filename - The filename (with extension)
 * @param mimeType - MIME type (default: text/plain)
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain"
): void {
  try {
    // Create blob from content
    const blob = new Blob([content], { type: mimeType });
    
    // Create object URL
    const url = URL.createObjectURL(blob);
    
    // Create temporary link element
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to download file:", error);
    throw error;
  }
}

/**
 * Generate a safe filename from a chain name
 * Removes special characters and limits length
 * 
 * @param chainName - The original chain name
 * @param extension - File extension (without dot)
 * @returns Sanitized filename
 */
export function generateFilename(
  chainName: string | undefined,
  extension: string
): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Default name if none provided
  if (!chainName || chainName.trim() === "") {
    return `argument-chain-${date}.${extension}`;
  }
  
  // Sanitize: lowercase, replace spaces/special chars with hyphens
  const sanitized = chainName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
  
  return `${sanitized}-${date}.${extension}`;
}

/**
 * Get MIME type for file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    html: "text/html",
    pdf: "application/pdf",
    csv: "text/csv"
  };
  
  return mimeTypes[extension] || "text/plain";
}
