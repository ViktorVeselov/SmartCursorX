function copyText(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const text = element.innerText || element.textContent;
  navigator.clipboard.writeText(text)
    .then(() => { alert('Copied to clipboard: ' + text); })
    .catch(err => { console.error('Failed to copy text: ', err); });
}

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar toggle (mobile)
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('doc-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Active nav link highlighting
  const currentPath = window.location.pathname.replace(/\/SmartCursorX\/?/, '/').replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-doc-link, .sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.endsWith(href.replace(/^\.\.?\/?/, '/'))) {
      link.classList.add('active');
    }
  });

  // Generate TOC from h2/h3 in doc-content
  const content = document.querySelector('.doc-content');
  if (content) {
    const headings = content.querySelectorAll('h2, h3');
    if (headings.length > 1) {
      const toc = document.createElement('div');
      toc.className = 'doc-toc';
      let html = '<div class="doc-toc-title">On This Page</div>';
      headings.forEach(h => {
        if (!h.id) {
          h.id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
        html += `<a href="#${h.id}" class="toc-${h.tagName.toLowerCase()}">${h.textContent}</a>`;
      });
      toc.innerHTML = html;
      content.insertBefore(toc, content.firstChild);
    }
  }

  // Download button OS detection
  const btnDownload = document.getElementById('btn-download-primary');
  const btnText = document.getElementById('btn-download-text');
  const releaseMeta = document.getElementById('release-meta-text');
  if (btnDownload && btnText && releaseMeta) {
    const isMac = navigator.userAgent.includes('Macintosh') || navigator.userAgent.includes('Mac Intel') || navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
      btnDownload.href = "https://github.com/ViktorVeselov/SmartCursorX/releases/latest/download/SmartCursorX-Mac-0.0.4-alpha-Installer.dmg";
      btnText.textContent = "Download for macOS (.dmg)";
      releaseMeta.textContent = "macOS DMG • Version 0.0.4-alpha • Cleaned by Scan";
    } else {
      btnDownload.href = "https://github.com/ViktorVeselov/SmartCursorX/releases/latest/download/SmartCursorX-Windows-0.0.4-alpha-Setup.exe";
      btnText.textContent = "Download for Windows (x64)";
      releaseMeta.textContent = "Windows Setup • Version 0.0.4-alpha • Cleaned by Scan";
    }
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});