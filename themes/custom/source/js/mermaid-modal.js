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
    var originX = '50%';
    var originY = '50%';

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
        originX = '50%';
        originY = '50%';
        updateTransform();

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

    // Update transform based on current scale and origin
    function updateTransform() {
      modalContent.style.transformOrigin = originX + ' ' + originY;
      modalContent.style.transform = 'scale(' + currentScale + ')';
    }

    // Update zoom origin based on mouse position
    function updateZoomOrigin(clientX, clientY) {
      var rect = modalContent.getBoundingClientRect();
      var x = ((clientX - rect.left) / rect.width) * 100;
      var y = ((clientY - rect.top) / rect.height) * 100;
      originX = Math.max(0, Math.min(100, x)) + '%';
      originY = Math.max(0, Math.min(100, y)) + '%';
    }

    // Zoom functions
    function zoomIn(clientX, clientY) {
      if (clientX !== undefined && clientY !== undefined) {
        updateZoomOrigin(clientX, clientY);
      }
      if (currentScale < maxScale) {
        currentScale = Math.min(currentScale + scaleStep, maxScale);
        updateTransform();
      }
    }

    function zoomOut(clientX, clientY) {
      if (clientX !== undefined && clientY !== undefined) {
        updateZoomOrigin(clientX, clientY);
      }
      if (currentScale > minScale) {
        currentScale = Math.max(currentScale - scaleStep, minScale);
        updateTransform();
      }
    }

    function resetZoom() {
      currentScale = 1;
      originX = '50%';
      originY = '50%';
      updateTransform();
    }

    // Event listeners
    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Track mouse position for zoom origin
    modalContent.addEventListener('mousemove', function(e) {
      if (modal.classList.contains('active')) {
        updateZoomOrigin(e.clientX, e.clientY);
      }
    });

    // Control buttons
    document.querySelectorAll('.mermaid-modal-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var action = this.dataset.action;
        // Buttons zoom from current origin (last mouse position)
        if (action === 'zoomIn') zoomIn();
        else if (action === 'zoomOut') zoomOut();
        else if (action === 'reset') resetZoom();
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (!modal.classList.contains('active')) return;

      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === '+' || e.key === '=') {
        // Keyboard zooms from current origin
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
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
