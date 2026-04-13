// DartVoice Particles System v1.0 - Hero Canvas Effects
// Features: Dart/soundwave particles, parallax mouse tracking, score bursts, brand tinting

class DartVoiceParticles {
    constructor(canvasId, opts = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // Config with defaults
        this.opts = {
            type: opts.type || 'hero', // 'hero', 'soundwave', 'scoreburst'
            count: opts.count || 80,
            brandHue: getComputedStyle(document.documentElement).getPropertyValue('--brand') || '#CC0B20',
            parallax: opts.parallax !== false,
            microInteractions: opts.microInteractions !== false,
            ...opts
        };
        
        this.particles = [];
        this.mouse = { x: 0, y: 0, prevX: 0, prevY: 0 };
        this.time = 0;
        this.init();
        this.bindEvents();
        this.animate();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.bounds = this.canvas.getBoundingClientRect();
    }
    
    init() {
        // Particle factory based on type
        const factories = {
            hero: () => this.createDartParticle(),
            soundwave: () => this.createSoundwaveParticle(),
            scoreburst: () => this.createScoreBurst()
        };
        
        for (let i = 0; i < this.opts.count; i++) {
            this.particles.push(factories[this.opts.type]());
        }
    }
    
    createDartParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 3 + 1,
            rotation: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.02,
            life: 1,
            type: 'dart',
            hue: this.hueFromBrand()
        };
    }
    
    createSoundwaveParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: this.canvas.height * 0.7 + Math.random() * 100,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -Math.random() * 2 - 1,
            size: Math.random() * 2 + 0.5,
            wavePhase: Math.random() * Math.PI * 2,
            life: 1,
            decay: 0.98,
            type: 'wave',
            hue: this.hueFromBrand()
        };
    }
    
    createScoreBurst() {
        return {
            x: this.mouse.x,
            y: this.mouse.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 2,
            size: Math.random() * 4 + 2,
            life: 1,
            decay: 0.96,
            type: 'burst',
            hue: this.hueFromBrand(),
            rot: 0,
            vrot: Math.random() * 0.3
        };
    }
    
    hueFromBrand() {
        const brandRGB = hexToRgb(this.opts.brandHue);
        return `hsla(${rgbToHsl(brandRGB).h}, 80%, 55%, 0.6)`;
    }
    
    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        
        if (this.opts.parallax) {
            document.addEventListener('mousemove', (e) => {
                this.mouse.x = e.clientX;
                this.mouse.y = e.clientY;
            });
        }
        
        // Score burst trigger (call externally)
        window.addScoreBurst = (x, y) => this.triggerBurst(x, y);
    }
    
    triggerBurst(x, y) {
        if (!x || !y) {
            x = this.mouse.x; y = this.mouse.y;
        }
        for (let i = 0; i < 12; i++) {
            this.particles.push(this.createScoreBurst());
        }
    }
    
    update() {
        this.time += 0.016; // ~60fps delta
        
        this.particles = this.particles.filter(p => {
            // Physics update
            p.x += p.vx;
            p.y += p.vy;
            if (p.rotation !== undefined) p.rotation += p.vrot || 0;
            
            // Parallax influence
            if (this.opts.parallax) {
                const px = (this.mouse.x / this.canvas.width - 0.5) * 100;
                const py = (this.mouse.y / this.canvas.height - 0.5) * 100;
                p.vx += px * 0.001;
                p.vy += py * 0.001;
            }
            
            // Boundary wrap
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
            
            // Life decay
            if (p.decay) p.life *= p.decay;
            if (p.life <= 0) return false;
            
            return p.life > 0.01;
        });
        
        // Respawn for hero type
        if (this.opts.type === 'hero' && this.particles.length < this.opts.count) {
            this.particles.push(this.createDartParticle());
        }
    }
    
    drawDart(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.hue;
        ctx.shadowColor = p.hue;
        ctx.shadowBlur = 8;
        
        // Dart shaft
        ctx.fillRect(-p.size * 0.2, -p.size * 0.5, p.size * 0.4, p.size);
        
        // Dart flight (triangle)
        ctx.beginPath();
        ctx.moveTo(p.size * 0.8, 0);
        ctx.lineTo(p.size * 0.4, -p.size * 0.6);
        ctx.lineTo(p.size * 0.4, p.size * 0.6);
        ctx.fill();
        
        ctx.restore();
    }
    
    drawSoundwave(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = `${p.hue}${Math.floor(p.life * 255).toString(16).padStart(2, '0')}`;
        ctx.shadowColor = p.hue;
        ctx.shadowBlur = 12 * p.life;
        
        const bars = 5;
        for (let i = 0; i < bars; i++) {
            const height = p.size * (1 + Math.sin(this.time * 4 + i + p.wavePhase) * 0.5) * p.life;
            ctx.fillRect(
                (i - bars/2) * p.size * 0.4,
                -height/2,
                p.size * 0.25,
                height
            );
        }
        ctx.restore();
    }
    
    drawBurst(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.hue;
        ctx.shadowColor = p.hue;
        ctx.shadowBlur = 16 * p.life;
        
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    render() {
        this.ctx.fillStyle = 'rgba(8, 8, 10, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(p => {
            switch(p.type) {
                case 'dart': this.drawDart(this.ctx, p); break;
                case 'wave': this.drawSoundwave(this.ctx, p); break;
                case 'burst': this.drawBurst(this.ctx, p); break;
            }
        });
    }
    
    animate() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// ── Utility functions ──
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return {r,g,b};
}

function rgbToHsl({r,g,b}) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h,s,l = (max + min) / 2;
    if (max === min) return {h:0,s:0,l};
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max){
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
    }
    return {h: h * 60, s, l};
}

// ── Init helpers ──
window.initParticles = function(canvasId, opts) {
    return new DartVoiceParticles(canvasId, opts);
};

window.initParallax = function(selectors, strength = 12) {
    const els = document.querySelectorAll(selectors);
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        els.forEach(el => {
            const rect = el.getBoundingClientRect();
            const rx = (x - 0.5) * strength;
            const ry = (y - 0.5) * strength;
            el.style.transform = `translate3d(${rx}px, ${ry}px, 0) rotateX(${-ry * 0.3}deg) rotateY(${rx * 0.3}deg)`;
        });
    });
};

window.initReveals = function() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
};

window.initRipples = function() {
    document.querySelectorAll('.btn-brand, .btn-outline').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position:absolute; border-radius:50%; background:rgba(255,255,255,0.4);
                width:${size}px; height:${size}px; left:${x}px; top:${y}px;
                transform:scale(0); animation:ripple 0.6s linear;
            `;
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
};

// CSS keyframes injection
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to { transform:scale(4); opacity:0; }
    }
    .reveal { opacity:0; transform:translateY(24px); transition:all 0.7s cubic-bezier(0.16,1,0.3,1); }
    .reveal.visible { opacity:1; transform:translateY(0); }
    .hud-magnetic { transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }
    .hud-magnetic:hover { transform:translateX(var(--tilt-x,0)) translateY(var(--tilt-y,0)) scale(1.02) !important; }
`;
document.head.appendChild(style);

