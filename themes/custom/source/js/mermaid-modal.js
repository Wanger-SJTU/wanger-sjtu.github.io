/**
 * Mermaid Modal - Click to zoom mermaid diagrams
 */

(function() {
  'use strict';

  // Wait for Mermaid to finish rendering
  function initMermaidModal() {
    // Create modal HTML
    var modalHTML = `
      <div class="mermaid-modal" id="mermaidModal">
        <div class="mermaid-modal-content" id="mermaidModalContent">
          <button class="mermaid-modal-close" id="mermaidModalClose">&times;</button>
          <div id="mermaidModalDiagram"></div>
          <div class="mermaid-modal-controls">
            <button class="mermaid-modal-btn" data-action="zoomOut">缩小</button>
            <button class="mermaid-modal-btn" data-action="reset">重置</button>
            <button class="mermaid-modal-btn" data-action="zoomIn">放大</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    var modal = document.getElementById('mermaidModal');
    var modalContent = document.getElementById('mermaidModalContent');
    var modalDiagram = document.getElementById('mermaidModalDiagram');
    var closeBtn = document.getElementById('mermaidModalClose');

    var currentScale = 1;
    var minScale = 0.5;
    var maxScale = 3;
    var scaleStep = 0.2;
    var translateX = 0;
    var translateY = 0;
    var mouseX = 0;
    var mouseY = 0;

    // Add click handlers to all mermaid diagrams
    function addClickHandlers() {
      var mermaidDiagrams = document.querySelectorAll('pre.mermaid');
      mermaidDiagrams.forEach(function(diagram) {
        diagram.addEventListener('click', function() {
          openModal(this);
        });
      });
    }

    // Open modal with diagram content
    function openModal(sourceDiagram) {
      // Copy the SVG to modal
      var svg = sourceDiagram.querySelector('svg');
      if (svg) {
        modalDiagram.innerHTML = '';
        var clonedSvg = svg.cloneNode(true);
        clonedSvg.style.width = '100%';
        clonedSvg.style.height = 'auto';
        modalDiagram.appendChild(clonedSvg);

        // Reset zoom
        currentScale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();

        // Initialize mouse position to center of modal
        var rect = modal.getBoundingClientRect();
        mouseX = rect.left + rect.width / 2;
        mouseY = rect.top + rect.height / 2;

        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    // Close modal
    function closeModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      modalDiagram.innerHTML = '';
    }

    // Update transform based on current scale and translation
    function updateTransform() {
      modalContent.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + currentScale + ')';
    }

    // Zoom functions centered on mouse position
    function zoomAtPoint(scaleChange, clientX, clientY) {
      var oldScale = currentScale;
      var newScale = Math.min(Math.max(currentScale + scaleChange, minScale), maxScale);

      if (newScale === oldScale) return;

      // Get content rect
      var rect = modalContent.getBoundingClientRect();

      // Calculate mouse position relative to content
      var mouseXOnContent = clientX - rect.left;
      var mouseYOnContent = clientY - rect.top;

      // Calculate scale ratio
      var scaleRatio = newScale / oldScale;

      // Update translation to keep mouse position fixed
      translateX = translateX - (mouseXOnContent * scaleRatio - mouseXOnContent);
      translateY = translateY - (mouseYOnContent * scaleRatio - mouseYOnContent);

      currentScale = newScale;
      updateTransform();
    }

    function zoomIn(clientX, clientY) {
      // If no coordinates provided, use center of modal
      if (clientX === undefined || clientY === undefined) {
        var rect = modal.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
      }
      zoomAtPoint(scaleStep, clientX, clientY);
    }

    function zoomOut(clientX, clientY) {
      // If no coordinates provided, use center of modal
      if (clientX === undefined || clientY === undefined) {
        var rect = modal.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
      }
      zoomAtPoint(-scaleStep, clientX, clientY);
    }

    function resetZoom() {
      currentScale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    }

    // Event listeners
    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Track mouse position for zoom centering
    modalContent.addEventListener('mousemove', function(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Control buttons
    document.querySelectorAll('.mermaid-modal-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var action = this.dataset.action;
        if (action === 'zoomIn') zoomIn(mouseX, mouseY);
        else if (action === 'zoomOut') zoomOut(mouseX, mouseY);
        else if (action === 'reset') resetZoom();
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (!modal.classList.contains('active')) return;

      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn(mouseX, mouseY);
      } else if (e.key === '-' || e.key === '_') {
        zoomOut(mouseX, mouseY);
      } else if (e.key === '0') {
        resetZoom();
      }
    });

    // Mouse wheel zoom centered on cursor
    modal.addEventListener('wheel', function(e) {
      if (!modal.classList.contains('active')) return;

      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn(e.clientX, e.clientY);
      } else {
        zoomOut(e.clientX, e.clientY);
      }
    }, { passive: false });

    // Initial setup and observe for new diagrams
    addClickHandlers();

    // Observe for dynamically added mermaid diagrams
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          addClickHandlers();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize after Mermaid is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Wait a bit for Mermaid to render
      setTimeout(initMermaidModal, 500);
    });
  } else {
    setTimeout(initMermaidModal, 500);
  }

})();
