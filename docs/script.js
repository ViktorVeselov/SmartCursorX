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
      // Temporary user feedback could go here (e.g. tooltip state triggers)
      alert('Copied to clipboard: ' + text);
    })
    .catch(err => {
      console.error('Failed to copy text into clipboard: ', err);
    });
}
