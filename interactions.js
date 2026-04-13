/**
 * DartVoice Interactive Micro-Animations
 * Tilt cards, ripples, counters, reveals
 */

// Parallax Tilt (3D card hover)
function initTiltCards() {
  document.querySelectorAll('.tilt-card, .feature-card, .media-card, .bento-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      card.style.boxShadow = '0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(204,11,32,0.2)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
      card.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
    });
  });
}

// Ripple Button Effect
function initRipples() {
  document.querySelectorAll('.btn-brand, .btn-outline').forEach(btn => {
    btn.addEventListener('click', e => {
      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px; height: ${size}px;
        left: ${x}px; top: ${y}px;
        background: rgba(255,255,255,0.4);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
      `;
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// Scroll-triggered counters
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.counter);
        let count = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
          count += increment;
          if (count < target) {
            el.textContent = Math.floor(count) + el.dataset.suffix || '';
          } else {
            el.textContent = target + (el.dataset.suffix || '');
            clearInterval(timer);
          }
        }, 20);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.7 });
  counters.forEach(counter => observer.observe(counter));
}

// Scroll reveals (IntersectionObserver)
function initReveals() {
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });
  reveals.forEach(reveal => observer.observe(reveal));
}

// Testimonials Carousel
function initTestimonials() {
  const carousel = document.querySelector('.testimonials-carousel');
  if (!carousel) return;
  let current = 0;
  const slides = carousel.querySelectorAll('.testimonial-slide');
  setInterval(() => {
    slides[current].style.opacity = '0';
    slides[current].style.transform = 'translateX(20px)';
    current = (current + 1) % slides.length;
    slides[current].style.opacity = '1';
    slides[current].style.transform = 'translateX(0)';
  }, 5000);
}

// Parallax mockups (extend particles.js parallax)
function initParallax(selectors, strength = 12) {
  document.querySelectorAll(selectors).forEach(el => {
    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'translate(0, 0)';
    });
  });
}

// Magnetic hover (HUD cards)
function initMagnetic() {
  document.querySelectorAll('.hud-card, .hud-magnetic').forEach(el => {
    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'translate(0, 0)';
    });
  });
}

// Score particle burst (for web-app.html integration)
function createScoreBurst(score, x, y) {
  for (let i = 0; i < 12; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px; width: 6px; height: 6px;
      background: #CC0B20; border-radius: 50%; pointer-events: none;
      transform: translate(-50%, -50%);
    `;
    const angle = (i / 12) * Math.PI * 2;
    const vel = 150 + Math.random() * 100;
    const vx = Math.cos(angle) * vel;
    const vy = Math.sin(angle) * vel;
    document.body.appendChild(particle);
    requestAnimationFrame(() => {
      particle.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 }
      ], { duration: 800, easing: 'ease-out' }).onfinish = () => particle.remove();
    });
  }
}

// Export for global use
window.DartVoiceInteractions = {
  initTiltCards,
  initRipples,
  initCounters,
  initReveals,
  initTestimonials,
  initParallax,
  initMagnetic,
  createScoreBurst
};

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initTiltCards();
  initRipples();
  initCounters();
  initReveals();
  initTestimonials();
  initParallax('.phone-frame, .laptop-frame, .media-card, .tilt-card', 15);
  initMagnetic();
});

// CSS keyframes injection (if needed)
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple {
    to { transform: scale(4); opacity: 0; }
  }
`;
document.head.appendChild(style);

