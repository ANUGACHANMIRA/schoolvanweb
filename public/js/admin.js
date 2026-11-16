/**
 * Safe Ride School Vans - Admin Management Dashboard Engine
 * Handles:
 * - Slideshow uploads with instant preview and client-side validation (jpg, png, webp, <= 5MB)
 * - Per-slide duration inline updating (min 1, max 60 seconds)
 * - Up/Down order swapping
 * - Active / Inactive toggle
 * - Deletion with confirmation
 * - Dynamic feedback toast messages
 */

document.addEventListener('DOMContentLoaded', () => {
  initImageUploadPreview();
  initSlideActions();
  initToast();
});

/* ==========================================================================
   1. TOAST NOTIFICATION UTILITY
   ========================================================================== */
function showToast(message, type = 'success') {
  let toast = document.getElementById('adminToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '2rem';
    toast.style.right = '2rem';
    toast.style.zIndex = '9999';
    toast.style.padding = '0.9rem 1.4rem';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = '700';
    toast.style.fontSize = '0.95rem';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    document.body.appendChild(toast);
  }

  if (type === 'success') {
    toast.style.backgroundColor = '#10B981';
    toast.style.color = '#FFFFFF';
  } else {
    toast.style.backgroundColor = '#EF4444';
    toast.style.color = '#FFFFFF';
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 3500);
}

/* ==========================================================================
   2. IMAGE UPLOAD PREVIEW & CLIENT VALIDATION
   ========================================================================== */
function initImageUploadPreview() {
  const fileInput = document.getElementById('slideImageInput');
  const previewContainer = document.getElementById('uploadPreviewContainer');
  const dropzone = document.getElementById('uploadDropzone');

  if (!fileInput || !previewContainer) return;

  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFiles(fileInput.files);
      }
    });
  }

  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
  });

  function handleFiles(files) {
    previewContainer.innerHTML = '';
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 5 * 1024 * 1024; // 5 MB

    let hasErrors = false;

    Array.from(files).forEach((file, idx) => {
      if (!allowedTypes.includes(file.type)) {
        showToast(`"${file.name}" is not a valid format. Only JPG, PNG, and WebP are allowed.`, 'danger');
        hasErrors = true;
        return;
      }

      if (file.size > maxBytes) {
        showToast(`"${file.name}" is too large. Max file size is 5MB.`, 'danger');
        hasErrors = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const chip = document.createElement('div');
        chip.className = 'preview-chip';
        chip.innerHTML = `
          <img src="${e.target.result}" alt="Slide upload preview ${idx + 1}" />
          <span style="position:absolute;bottom:2px;left:4px;font-size:10px;background:rgba(0,0,0,0.7);color:#fff;padding:1px 4px;border-radius:3px;">
            ${(file.size / (1024 * 1024)).toFixed(2)} MB
          </span>
        `;
        previewContainer.appendChild(chip);
      };
      reader.readAsDataURL(file);
    });

    if (hasErrors) {
      fileInput.value = '';
      previewContainer.innerHTML = '';
    }
  }
}

/* ==========================================================================
   3. SLIDE ACTIONS (DURATION, REORDER, ACTIVE TOGGLE, DELETE)
   ========================================================================== */
function initSlideActions() {
  const container = document.getElementById('slidesContainer');
  if (!container) return;

  // 1. DURATION INPUT CHANGE / SAVE
  container.addEventListener('change', async (e) => {
    if (e.target.classList.contains('slide-duration-input')) {
      const input = e.target;
      const slideId = input.getAttribute('data-id');
      let val = parseInt(input.value, 10);

      if (isNaN(val) || val < 1) val = 1;
      if (val > 60) val = 60;
      input.value = val;

      try {
        const res = await fetch(`/admin/api/slides/${slideId}/duration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration_seconds: val })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Duration updated to ${val}s. (Active on next page load)`);
        } else {
          showToast(data.error || 'Failed to update duration', 'danger');
        }
      } catch (err) {
        showToast('Network error while saving duration', 'danger');
      }
    }
  });

  // 2. TOGGLE ACTIVE / INACTIVE
  container.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('.toggle-active-btn');
    if (toggleBtn) {
      const slideId = toggleBtn.getAttribute('data-id');
      const card = document.getElementById(`slide-card-${slideId}`);

      try {
        const res = await fetch(`/admin/api/slides/${slideId}/toggle-active`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          const isActive = data.is_active === 1;
          showToast(isActive ? 'Slide is now ACTIVE and visible on homepage' : 'Slide HIDDEN from homepage');
          
          if (card) {
            card.classList.toggle('inactive', !isActive);
            const badge = card.querySelector('.slide-status-badge');
            if (badge) {
              badge.className = `slide-status-badge ${isActive ? 'badge-active' : 'badge-inactive'}`;
              badge.textContent = isActive ? 'Active' : 'Hidden';
            }
          }
          toggleBtn.textContent = isActive ? 'Hide' : 'Show';
          toggleBtn.className = `btn btn-sm toggle-active-btn ${isActive ? 'btn-outline-navy' : 'btn-success'}`;
        } else {
          showToast(data.error || 'Failed to toggle status', 'danger');
        }
      } catch (err) {
        showToast('Network error while toggling status', 'danger');
      }
    }
  });

  // 3. REORDER SLIDES (UP / DOWN)
  container.addEventListener('click', async (e) => {
    const reorderBtn = e.target.closest('.reorder-btn');
    if (reorderBtn) {
      const slideId = reorderBtn.getAttribute('data-id');
      const direction = reorderBtn.getAttribute('data-direction');

      try {
        const res = await fetch(`/admin/api/slides/${slideId}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Slide order updated');
          window.location.reload();
        } else {
          showToast(data.error || 'Unable to reorder slide', 'danger');
        }
      } catch (err) {
        showToast('Network error while reordering', 'danger');
      }
    }
  });

  // 4. DELETE SLIDE
  container.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-slide-btn');
    if (deleteBtn) {
      const slideId = deleteBtn.getAttribute('data-id');
      const confirmDelete = window.confirm('Are you sure you want to permanently delete this slide? This removes the image file and its database record.');

      if (confirmDelete) {
        try {
          const res = await fetch(`/admin/api/slides/${slideId}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
            showToast('Slide deleted successfully');
            const card = document.getElementById(`slide-card-${slideId}`);
            if (card) {
              card.remove();
            }
          } else {
            showToast(data.error || 'Failed to delete slide', 'danger');
          }
        } catch (err) {
          showToast('Network error deleting slide', 'danger');
        }
      }
    }
  });
}

function initToast() {
  // Check if there are query parameter flash messages in URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('msg')) {
    showToast(decodeURIComponent(urlParams.get('msg')), 'success');
  }
  if (urlParams.get('err')) {
    showToast(decodeURIComponent(urlParams.get('err')), 'danger');
  }
}
