/**
 * Copies plain text content from a DOM element into the client clipboard.
 * @param {string} elementId - The unique ID of the source DOM element.
 */
function copyText(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const text = element.innerText || element.textContent;

  navigator.clipboard.writeText(text)
    .then(() => {
      alert('Copied to clipboard: ' + text);
    })
    .catch(err => {
      console.error('Failed to copy text into clipboard: ', err);
    });
}

/**
 * Dynamically detects the user's OS and shapes the primary CTA download button.
 */
document.addEventListener('DOMContentLoaded', () => {
  const btnDownload = document.getElementById('btn-download-primary');
  const btnText = document.getElementById('btn-download-text');
  const releaseMeta = document.getElementById('release-meta-text');

  if (!btnDownload || !btnText || !releaseMeta) return;

  const isMac = navigator.userAgent.includes('Macintosh') ||
    navigator.userAgent.includes('Mac Intel') ||
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  if (isMac) {
    // Dynamic shaping for macOS platforms
    btnDownload.href = "https://github.com/ViktorVeselov/SmartCursorX/releases/latest/download/SmartCursorX-Mac-0.0.2-alpha-Installer.dmg";
    btnText.textContent = "Download for macOS (.dmg)";
    releaseMeta.textContent = "macOS DMG • Version 0.0.2-alpha • Cleaned by Scan";
  } else {
    // Default/dynamic shape for Windows platforms
    btnDownload.href = "https://github.com/ViktorVeselov/SmartCursorX/releases/latest/download/SmartCursorX-Windows-0.0.2-alpha-Setup.exe";
    btnText.textContent = "Download for Windows (x64)";
    releaseMeta.textContent = "Windows Setup • Version 0.0.1-alpha • Cleaned by Scan";
  }
});
