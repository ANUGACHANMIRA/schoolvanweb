/**
 * Safe Ride School Vans - Frontend Client Engine
 * Features:
 * - Responsive mobile navigation toggle
 * - Dynamic Variable-Duration Slideshow Engine with pause on hover, arrows, dots
 * - Contact Form AJAX handler with success feedback
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initHeroSlideshow();
  initContactForm();
});

/* ==========================================================================
   1. MOBILE NAVIGATION
   ========================================================================== */
function initMobileNav() {
  const hamburger = document.getElementById('hamburgerBtn');
  const navMenu = document.getElementById('navMenu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      hamburger.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen);
    });

    // Close menu when clicking outside or clicking a link
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !navMenu.contains(e.target) && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

/* ==========================================================================
   2. VARIABLE-DURATION HERO SLIDESHOW ENGINE
   ========================================================================== */
function initHeroSlideshow() {
  const slider = document.getElementById('heroSlider');
  if (!slider) return;

  const slides = slider.querySelectorAll('.slide-item');
  const dotsContainer = document.getElementById('sliderDots');
  const prevBtn = document.getElementById('sliderPrev');
  const nextBtn = document.getElementById('sliderNext');

  if (!slides || slides.length <= 1) {
    // Only one slide or fallback placeholder - no need for autoplay timers
    return;
  }

  let currentIndex = 0;
  let timerId = null;
  let isPaused = false;

  // Build dots
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.className = `slider-dot ${idx === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Go to slide ${idx + 1}`);
      dot.addEventListener('click', () => {
        goToSlide(idx);
      });
      dotsContainer.appendChild(dot);
    });
  }

  function getSlideDuration(index) {
    const slide = slides[index];
    if (!slide) return 5000;
    const durSec = parseFloat(slide.getAttribute('data-duration')) || 5;
    return Math.max(1, Math.min(60, durSec)) * 1000; // convert to ms
  }

  function updateSlideDisplay(newIndex) {
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === newIndex);
    });

    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll('.slider-dot');
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === newIndex);
      });
    }

    currentIndex = newIndex;
  }

  function scheduleNextSlide() {
    clearTimeout(timerId);
    if (isPaused) return;

    const currentDuration = getSlideDuration(currentIndex);
    timerId = setTimeout(() => {
      if (!isPaused) {
        const nextIndex = (currentIndex + 1) % slides.length;
        goToSlide(nextIndex);
      }
    }, currentDuration);
  }

  function goToSlide(index) {
    clearTimeout(timerId);
    updateSlideDisplay(index);
    scheduleNextSlide();
  }

  function nextSlide() {
    const nextIdx = (currentIndex + 1) % slides.length;
    goToSlide(nextIdx);
  }

  function prevSlide() {
    const prevIdx = (currentIndex - 1 + slides.length) % slides.length;
    goToSlide(prevIdx);
  }

  // Prev / Next button listeners
  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      prevSlide();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      nextSlide();
    });
  }

  // Keyboard navigation
  slider.setAttribute('tabindex', '0');
  slider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'ArrowRight') nextSlide();
  });

  // Pause on hover
  slider.addEventListener('mouseenter', () => {
    isPaused = true;
    clearTimeout(timerId);
  });

  slider.addEventListener('mouseleave', () => {
    isPaused = false;
    scheduleNextSlide();
  });

  // Touch swipe support for mobile
  let touchStartX = 0;
  let touchEndX = 0;
  slider.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  slider.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) {
      nextSlide();
    } else if (touchEndX - touchStartX > 50) {
      prevSlide();
    }
  }, { passive: true });

  // Start the slideshow
  scheduleNextSlide();
}

/* ==========================================================================
   3. CONTACT FORM AJAX HANDLER
   ========================================================================== */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const alertBox = document.getElementById('contactAlert');
  const submitBtn = document.getElementById('contactSubmitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !message) {
      showAlert('Please fill in your Name, Email, and Message.', 'danger');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending Message...';
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ name, phone, email, message })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showAlert(data.message || 'Thank you! Your message has been sent successfully. Our team will contact you shortly.', 'success');
        form.reset();
      } else {
        showAlert(data.error || 'Unable to submit your message. Please check the details and try again.', 'danger');
      }
    } catch (err) {
      console.error('Contact submit error:', err);
      showAlert('A network error occurred. Please try calling us directly at (555) 392-8267.', 'danger');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send Message';
      }
    }
  });

  function showAlert(msg, type) {
    if (!alertBox) {
      alert(msg);
      return;
    }
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.style.display = 'block';
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
