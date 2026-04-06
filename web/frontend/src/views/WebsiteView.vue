<template>
  <div class="esa-website" :class="{ dark: isDark }">

    <!-- ══════════════════════ NAV ══════════════════════ -->
    <nav class="site-nav" :class="{ scrolled: scrolled }">
      <div class="nav-inner">
        <a href="#home" class="nav-brand" @click.prevent="navTo('#home')">
          <img src="/esa-logo.png" alt="ESA" class="nav-logo" />
          <div>
            <div class="nav-name">ESA</div>
            <div class="nav-sub">Smart Attendance</div>
          </div>
        </a>

        <div class="nav-links">
          <a href="#how-it-works" class="nav-link" :class="{active: activeSection==='how-it-works'}" @click.prevent="navTo('#how-it-works')">How It Works</a>
          <a href="#features" class="nav-link" :class="{active: activeSection==='features'}" @click.prevent="navTo('#features')">Features</a>
          <a href="#download" class="nav-link" :class="{active: activeSection==='download'}" @click.prevent="navTo('#download')">Download</a>
          <a href="#trusted" class="nav-link" :class="{active: activeSection==='trusted'}" @click.prevent="navTo('#trusted')">Schools</a>
          <a href="#contact" class="nav-link" :class="{active: activeSection==='contact'}" @click.prevent="navTo('#contact')">Contact</a>
        </div>

        <div class="nav-actions">
          <button class="theme-btn" @click="toggleDark" :title="isDark ? 'Light mode' : 'Dark mode'">
            <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          </button>
          <div class="nav-cta">
            <a href="/login" class="btn btn-ghost" style="padding:7px 16px;font-size:13px">Sign In</a>
            <a href="#contact" class="btn btn-primary" style="padding:7px 18px;font-size:13px" @click.prevent="navTo('#contact')">Get Started</a>
          </div>
          <button class="hamburger" @click="mobileOpen = !mobileOpen">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <div class="mobile-menu" :class="{ open: mobileOpen }">
        <a href="#how-it-works" class="mob-link" @click.prevent="navTo('#how-it-works', true)">How It Works</a>
        <a href="#features" class="mob-link" @click.prevent="navTo('#features', true)">Features</a>
        <a href="#download" class="mob-link" @click.prevent="navTo('#download', true)">Download</a>
        <a href="#trusted" class="mob-link" @click.prevent="navTo('#trusted', true)">Schools</a>
        <a href="#contact" class="mob-link" @click.prevent="navTo('#contact', true)">Contact</a>
        <div class="mob-cta">
          <a href="/login"   class="btn btn-ghost"   style="flex:1;justify-content:center">Sign In</a>
          <a href="#contact" class="btn btn-primary" style="flex:1;justify-content:center" @click.prevent="navTo('#contact', true)">Get Started</a>
        </div>
      </div>
    </nav>

    <!-- ══════════════════════ HERO ══════════════════════ -->
    <section class="hero" id="home">
      <div class="orb hero-orb-1"></div>
      <div class="orb hero-orb-2"></div>
      <div class="container">
        <div class="hero-inner">
          <!-- Left -->
          <div class="hero-left">
            <div class="hero-badge">
              <span class="badge-dot"></span>
              Now available for schools everywhere
            </div>
            <h1 class="hero-title">
              Smart <span class="gradient-text">Attendance</span><br>
              for Modern Schools
            </h1>
            <p class="hero-desc">
              ESA uses GPS &amp; Wi-Fi technology to automate teacher attendance tracking — real-time dashboards, instant reports, and multi-school management from a single platform.
            </p>
            <div class="hero-actions">
              <a href="#contact" class="btn btn-primary btn-xl" @click.prevent="navTo('#contact')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                Request Access
              </a>
              <a href="#how-it-works" class="btn btn-outline btn-xl" @click.prevent="navTo('#how-it-works')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 16 12 12 16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                See How It Works
              </a>
            </div>
            <div class="hero-stats">
              <div class="hero-stat"><div class="hstat-val">{{ schoolCount }}</div><div class="hstat-lbl">Active Schools</div></div>
              <div class="hero-stat"><div class="hstat-val">99.9%</div><div class="hstat-lbl">Uptime</div></div>
              <div class="hero-stat"><div class="hstat-val">&lt;50ms</div><div class="hstat-lbl">Real-time</div></div>
            </div>
          </div>

          <!-- Right: Live card (shows below on mobile) -->
          <div class="hero-right">
            <div class="hero-card glass-lg">
              <div class="hc-topbar">
                <div class="hc-dots">
                  <span style="background:#ef4444"></span>
                  <span style="background:#f59e0b"></span>
                  <span style="background:#10b981"></span>
                </div>
                <span class="hc-title">Live Attendance — Today</span>
                <span class="hc-live">● Live</span>
              </div>
              <div class="hc-stats">
                <div class="hc-stat"><div class="hcs-val" style="color:var(--success)">18</div><div class="hcs-lbl">Present</div></div>
                <div class="hc-stat"><div class="hcs-val" style="color:var(--warning)">3</div><div class="hcs-lbl">Late</div></div>
                <div class="hc-stat"><div class="hcs-val" style="color:var(--danger)">2</div><div class="hcs-lbl">Absent</div></div>
              </div>
              <div class="hc-teachers">
                <div class="hc-teacher" v-for="t in heroTeachers" :key="t.name">
                  <div class="hc-av" :style="`background:${t.bg}`">{{ t.init }}</div>
                  <div class="hc-tname">{{ t.name }}</div>
                  <span class="hc-status" :class="t.status">{{ t.status }}</span>
                </div>
              </div>
            </div>
            <!-- Float cards -->
            <div class="glass hero-float hero-float-r">
              <div class="float-ic" style="background:rgba(37,99,235,0.12)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div><div class="float-lbl">GPS Verified</div><div class="float-val" style="color:var(--success)">✓ On campus</div></div>
            </div>
            <div class="glass hero-float hero-float-l">
              <div class="float-ic" style="background:rgba(16,185,129,0.12)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div><div class="float-lbl">Attendance Rate</div><div class="float-val" style="color:var(--primary)">87.5%</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════ STATS BAR ══════════════════════ -->
    <div class="stats-bar">
      <div class="stats-bar-inner container">
        <div class="sbar-item" v-for="s in statBarItems" :key="s.label">
          <div class="sbar-icon">
            <component :is="'svg'" v-bind="s.svgProps" v-html="s.svgPath"></component>
          </div>
          <div class="sbar-text">
            <div class="sbar-val">{{ s.val }}</div>
            <div class="sbar-lbl">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════ HOW IT WORKS ══════════════════════ -->
    <section id="how-it-works" class="section-pad">
      <div class="container">
        <div class="section-header-center">
          <div class="section-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            How It Works
          </div>
          <h2 class="section-title">Simple. Automated. Reliable.</h2>
          <p class="section-desc mx-auto">From school setup to daily attendance — ESA makes the entire process effortless in four simple steps.</p>
        </div>
        <div class="steps-grid">
          <div class="glass step-card" v-for="s in steps" :key="s.num">
            <div class="step-num">{{ s.num }}</div>
            <div class="step-icon-wrap" :style="`background:${s.iconBg}`">
              <component :is="'svg'" v-bind="s.svgProps" v-html="s.svgPath"></component>
            </div>
            <div class="step-title">{{ s.title }}</div>
            <div class="step-desc">{{ s.desc }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════ FEATURES ══════════════════════ -->
    <section id="features" class="section-pad features-bg">
      <div class="container">
        <div>
          <div class="section-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Platform Features
          </div>
          <h2 class="section-title">Everything Your School Needs</h2>
          <p class="section-desc">A complete attendance management platform built specifically for educational institutions.</p>
        </div>
        <div class="features-grid">
          <div class="glass feature-card" v-for="f in features" :key="f.title">
            <div class="feature-icon" :style="`background:${f.iconBg}`">
              <component :is="'svg'" v-bind="f.svgProps" v-html="f.svgPath"></component>
            </div>
            <div class="feature-title">{{ f.title }}</div>
            <div class="feature-desc">{{ f.desc }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════ DOWNLOAD ══════════════════════ -->
    <section id="download" class="section-pad download-bg">
      <div class="container">
        <div class="section-header-center">
          <div class="section-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download ESA
          </div>
          <h2 class="section-title">Available on All Platforms</h2>
          <p class="section-desc mx-auto">ESA runs natively on Android, iOS, and desktop — teachers can check in from any device, anywhere on campus.</p>
        </div>
        <div class="download-grid">
          <!-- Mobile -->
          <div class="glass download-card">
            <div class="dc-header">
              <div class="dc-icon" style="background:linear-gradient(135deg,rgba(37,99,235,0.15),rgba(6,182,212,0.1))">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18" stroke-width="3"/></svg>
              </div>
              <div>
                <div class="dc-title">Mobile App</div>
                <div class="dc-subtitle">Android &amp; iOS</div>
              </div>
            </div>
            <div class="dc-features">
              <div class="dc-feat" v-for="f in mobileFeatures" :key="f">
                <div class="dc-check">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                {{ f }}
              </div>
            </div>
            <!-- Store buttons -->
            <div class="dc-stores">
              <a href="https://apps.apple.com" target="_blank" rel="noopener" class="store-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="store-icon"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div>
                  <div class="store-btn-sub">Download on the</div>
                  <div class="store-btn-name">App Store</div>
                </div>
              </a>
              <a href="https://play.google.com" target="_blank" rel="noopener" class="store-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="store-icon"><path d="M3.18 23.76c.3.17.64.24.99.18l.06-.03 11.35-6.54-2.47-2.46-9.93 8.85zM.54 2.28C.2 2.6 0 3.13 0 3.84v16.32c0 .71.2 1.24.55 1.55l.08.07L9.6 12.8v-.22L.62 2.22l-.08.06zM19.94 10.54l-2.89-1.67-2.77 2.76 2.77 2.77 2.9-1.67c.83-.48.83-1.25-.01-2.19zM4.17.24L15.52 6.78l-2.47 2.47L3.12.4l.06-.03c.34-.07.68 0 .99.17z"/></svg>
                <div>
                  <div class="store-btn-sub">Get it on</div>
                  <div class="store-btn-name">Google Play</div>
                </div>
              </a>
            </div>
          </div>

          <!-- Desktop -->
          <div class="glass download-card">
            <div class="dc-header">
              <div class="dc-icon" style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(37,99,235,0.1))">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <div>
                <div class="dc-title">Desktop App</div>
                <div class="dc-subtitle">Windows, macOS &amp; Linux</div>
              </div>
            </div>
            <div class="dc-features">
              <div class="dc-feat" v-for="f in desktopFeatures" :key="f">
                <div class="dc-check">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                {{ f }}
              </div>
            </div>
            <div class="dc-stores">
              <a :href="`${apiBase}/downloads/windows`" class="store-btn" download>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="store-icon"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
                <div>
                  <div class="store-btn-sub">Download for</div>
                  <div class="store-btn-name">Windows</div>
                </div>
              </a>
              <a :href="`${apiBase}/downloads/mac`" class="store-btn" download>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="store-icon"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div>
                  <div class="store-btn-sub">Download for</div>
                  <div class="store-btn-name">macOS</div>
                </div>
              </a>
            </div>
          </div>
        </div>
        <p class="download-note">
          Also accessible via web browser — no installation required.
          <a href="/login" class="link-primary">Sign in here →</a>
        </p>
      </div>
    </section>

    <!-- ══════════════════════ TRUSTED SCHOOLS ══════════════════════ -->
    <section id="trusted" class="section-pad">
      <div class="container">
        <div class="section-header-center">
          <div class="section-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Trusted Schools
          </div>
          <h2 class="section-title">Schools Already Using ESA</h2>
          <p class="section-desc mx-auto">Join the growing community of schools that rely on ESA for accurate, automated attendance management.</p>
        </div>
      </div>
      <div class="trusted-wrap">
        <div class="trusted-track" ref="trackRef">
          <div
            class="glass school-badge"
            v-for="(s, i) in trustedDouble"
            :key="i"
          >
            <img v-if="s.logo_url" :src="websiteLogoSrc(s.logo_url)" :alt="s.name" class="school-logo" />
            <div v-else class="school-initial-wrap">
              <div class="school-initial">{{ initials(s.name) }}</div>
              <div class="school-short">{{ s.name.length > 14 ? s.name.slice(0,13)+'…' : s.name }}</div>
            </div>
            <div class="school-tooltip">{{ s.name }}</div>
          </div>
        </div>
      </div>
      <div class="container" style="margin-top:32px;text-align:center">
        <p style="font-size:14px;color:var(--text-muted)">
          Want your school featured here?
          <a href="#contact" class="link-primary">Request access →</a>
        </p>
      </div>
    </section>

    <!-- ══════════════════════ CONTACT ══════════════════════ -->
    <section id="contact" class="section-pad contact-bg">
      <div class="container">
        <div class="contact-grid">
          <!-- Left -->
          <div>
            <div class="section-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Get in Touch
            </div>
            <h2 class="section-title">Ready to Transform Your School's Attendance?</h2>
            <p class="section-desc">Fill out the form and our team will set up ESA for your school. No complex installation — we guide you through every step.</p>
            <div class="contact-info-cards">
              <div class="glass ci-card" v-for="ci in contactInfo" :key="ci.label">
                <div class="ci-icon" :style="`background:${ci.bg}`">
                  <component :is="'svg'" v-bind="ci.svgProps" v-html="ci.svgPath"></component>
                </div>
                <div>
                  <div class="ci-label">{{ ci.label }}</div>
                  <div class="ci-val">{{ ci.val }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Form -->
          <div class="glass contact-form-card">
            <h3 style="font-size:20px;font-weight:800;margin-bottom:6px">Send a Request</h3>
            <p style="font-size:14px;color:var(--text-muted);margin-bottom:24px">You'll receive a confirmation email and we'll be in touch shortly.</p>

            <form @submit.prevent="submitContact" style="display:flex;flex-direction:column;gap:18px">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Full Name *</label>
                  <input class="form-input" v-model="form.full_name" placeholder="Your full name" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Email Address *</label>
                  <input class="form-input" type="email" v-model="form.email" placeholder="your@email.com" required />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Phone Number</label>
                  <input class="form-input" type="tel" v-model="form.phone" placeholder="+250 7xx xxx xxx" />
                </div>
                <div class="form-group">
                  <label class="form-label">School Name</label>
                  <input class="form-input" v-model="form.school_name" placeholder="Your school name" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Message</label>
                <textarea class="form-input" style="min-height:110px;resize:vertical" v-model="form.message" placeholder="Tell us about your school, number of teachers, or any questions..." />
              </div>
              <button type="submit" class="btn btn-primary" style="padding:14px;font-size:15px;font-weight:700;width:100%" :disabled="submitting">
                <div v-if="submitting" class="spinner" style="width:18px;height:18px;border-color:rgba(255,255,255,.3);border-top-color:#fff"></div>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {{ submitting ? 'Sending…' : 'Send Request' }}
              </button>

              <div v-if="formMsg" class="form-msg" :class="formMsg.type">
                <svg v-if="formMsg.type==='success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {{ formMsg.text }}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════ FOOTER ══════════════════════ -->
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">
              <img src="/esa-logo.png" alt="ESA" class="footer-logo" />
              <span class="footer-brand-name">ESA</span>
            </div>
            <p class="footer-tagline">Employee Smart Attendance — automated, verified GPS &amp; Wi-Fi attendance for modern schools.</p>
          </div>
          <div>
            <div class="footer-col-title">Product</div>
            <a href="#how-it-works" class="footer-link">How It Works</a>
            <a href="#features"     class="footer-link">Features</a>
            <a href="#download"     class="footer-link">Download</a>
            <a href="#contact"      class="footer-link">Get Started</a>
          </div>
          <div>
            <div class="footer-col-title">Platform</div>
            <a href="/login"    class="footer-link">Sign In</a>
            <a href="#download" class="footer-link">Mobile App</a>
            <a href="#download" class="footer-link">Desktop App</a>
            <a href="#trusted"  class="footer-link">Partner Schools</a>
          </div>
          <div>
            <div class="footer-col-title">Support</div>
            <a href="#contact" class="footer-link">Contact Us</a>
            <a href="#contact" class="footer-link">Request Demo</a>
            <a href="#contact" class="footer-link">Onboarding</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span class="footer-copy">© {{ new Date().getFullYear() }} ESA — Employee Smart Attendance System. All rights reserved.</span>
          <div class="footer-pills">
            <span class="footer-pill">v2.1.0</span>
            <span class="footer-pill">AES-256</span>
            <span class="footer-pill">GDPR Ready</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- ══════════ BACK TO TOP ══════════ -->
    <button class="back-top" :class="{ visible: showBackTop }" @click="scrollTop">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
    </button>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useDark } from '../composables/useDark'
import api from '../api'

// ── Theme: use global composable so it syncs with dashboard ──
const { isDark, toggleDark } = useDark()

// ── Nav scroll + active section tracking ─────────────────────
const scrolled      = ref(false)
const showBackTop   = ref(false)
const mobileOpen    = ref(false)
const activeSection = ref('home')
const sectionIds    = ['home','how-it-works','features','download','trusted','contact']
const headState = {
  title: '',
  description: '',
  robots: '',
  canonical: '',
  structuredDataEl: null,
}

function onScroll() {
  const y = window.scrollY
  scrolled.value    = y > 20
  showBackTop.value = y > 400
  for (let i = sectionIds.length - 1; i >= 0; i--) {
    const el = document.getElementById(sectionIds[i])
    if (el && el.getBoundingClientRect().top <= 80) {
      activeSection.value = sectionIds[i]
      break
    }
  }
}
function scrollTop() {
  mobileOpen.value = false
  activeSection.value = 'home'
  showBackTop.value = false
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => {
      const root = document.scrollingElement || document.documentElement
      if ((root?.scrollTop ?? window.scrollY) > 2) {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      }
    }, 420)
  } catch {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
}

// Smooth scroll with 68px navbar offset
function navTo(hash, closeMob = false) {
  if (closeMob) mobileOpen.value = false
  const id = hash.replace('#', '')
  const el = document.getElementById(id)
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - 68
    window.scrollTo({ top, behavior: 'smooth' })
  }
}

function applyWebsiteSeoMeta() {
  headState.title = document.title
  headState.description = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
  headState.robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || ''
  headState.canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''

  document.title = 'ESA Attendance System for Schools | GPS Teacher Attendance Tracking'

  let descriptionMeta = document.querySelector('meta[name="description"]')
  if (!descriptionMeta) {
    descriptionMeta = document.createElement('meta')
    descriptionMeta.setAttribute('name', 'description')
    document.head.appendChild(descriptionMeta)
  }
  descriptionMeta.setAttribute('content', 'ESA attendance system helps schools track teacher attendance with GPS geolocation, Wi-Fi validation, real-time dashboard monitoring, and automated attendance reports.')

  let robotsMeta = document.querySelector('meta[name="robots"]')
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta')
    robotsMeta.setAttribute('name', 'robots')
    document.head.appendChild(robotsMeta)
  }
  robotsMeta.setAttribute('content', 'index,follow')

  let canonicalLink = document.querySelector('link[rel="canonical"]')
  if (!canonicalLink) {
    canonicalLink = document.createElement('link')
    canonicalLink.setAttribute('rel', 'canonical')
    document.head.appendChild(canonicalLink)
  }
  canonicalLink.setAttribute('href', `${window.location.origin}/website`)

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ESA - Employee Smart Attendance System',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Android, Windows',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: 'School attendance tracking system with GPS geolocation verification, Wi-Fi validation, real-time dashboard, and automated reporting.',
    url: `${window.location.origin}/website`,
    featureList: [
      'GPS attendance system',
      'Attendance system with geolocation',
      'Teacher attendance tracking',
      'Real-time attendance dashboard',
      'Automated attendance reports',
      'Multi-school attendance management',
    ],
  }
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.text = JSON.stringify(structuredData)
  document.head.appendChild(script)
  headState.structuredDataEl = script
}

function restoreWebsiteSeoMeta() {
  if (headState.title) document.title = headState.title

  const descriptionMeta = document.querySelector('meta[name="description"]')
  if (descriptionMeta) descriptionMeta.setAttribute('content', headState.description)

  const robotsMeta = document.querySelector('meta[name="robots"]')
  if (robotsMeta) robotsMeta.setAttribute('content', headState.robots)

  const canonicalLink = document.querySelector('link[rel="canonical"]')
  if (canonicalLink) canonicalLink.setAttribute('href', headState.canonical)

  if (headState.structuredDataEl && headState.structuredDataEl.parentNode) {
    headState.structuredDataEl.parentNode.removeChild(headState.structuredDataEl)
  }
  headState.structuredDataEl = null
}

onMounted(() => {
  onScroll()
  applyWebsiteSeoMeta()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  restoreWebsiteSeoMeta()
})

// ── API base ─────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'
const apiBase = API.replace('/api', '')

// ── School count ─────────────────────────────────────────────
const schoolCount = ref('10+')
onMounted(async () => {
  try {
    const d = await api.get('/website/schools-count')
    if (d?.active > 0) schoolCount.value = d.active + '+'
  } catch {}
})

// ── Trusted schools ──────────────────────────────────────────
const trustedSchools = ref([])
const trustedDouble  = computed(() => {
  let list = trustedSchools.value.length ? trustedSchools.value : [
    { name: 'Green Hills Academy' }, { name: 'College of Excellence' },
    { name: 'Kigali Secondary'    }, { name: 'Horizon International'  },
    { name: 'Bright Future School'}, { name: 'Sunrise Academy'        },
    { name: 'Vision School'       }, { name: 'Excellence Center'      },
  ]
  // Ensure at least 8 items so marquee always looks full
  while (list.length < 8) list = [...list, ...list]
  // Triple the list: first copy scrolls away, second+third stay visible = endless loop
  return [...list, ...list, ...list]
})

onMounted(async () => {
  try {
    const d = await api.get('/website/trusted-schools')
    if (Array.isArray(d) && d.length) trustedSchools.value = d
  } catch {}
})

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// Convert stored logo path to a displayable URL.
// The website fetches data directly (no Vite /uploads proxy in scope), so we
// must prepend the backend base URL for relative /uploads/... paths.
function websiteLogoSrc(url) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('//')) return url
  // Relative /uploads/... — prepend the backend origin so the <img> src is absolute
  return `${apiBase}${url}`
}

// ── Hero data ─────────────────────────────────────────────────
const heroTeachers = [
  { name:'Jean Keza',     init:'JK', bg:'linear-gradient(135deg,#2563eb,#06b6d4)', status:'present' },
  { name:'Marie Nziza',   init:'MN', bg:'linear-gradient(135deg,#f59e0b,#d97706)', status:'late'    },
  { name:'Aimable Bahizi',init:'AB', bg:'linear-gradient(135deg,#10b981,#059669)', status:'present' },
  { name:'Grace Uwera',   init:'GU', bg:'linear-gradient(135deg,#8b5cf6,#7c3aed)', status:'absent'  },
]

// ── Stats bar ─────────────────────────────────────────────────
const statBarItems = [
  {
    val:'100%', label:'GPS Accuracy',
    svgProps:{ width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'rgba(255,255,255,0.9)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
  },
  {
    val:'3', label:'User Roles',
    svgProps:{ width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'rgba(255,255,255,0.9)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  },
  {
    val:'Real-time', label:'Live Updates',
    svgProps:{ width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'rgba(255,255,255,0.9)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  },
  {
    val:'AES-256', label:'Encrypted',
    svgProps:{ width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'rgba(255,255,255,0.9)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
  },
]

// ── How it works steps ────────────────────────────────────────
const steps = [
  { num:'01', title:'School Registration', iconBg:'rgba(37,99,235,0.1)',
    svgProps:{ width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'var(--primary)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    desc:'Super admin creates your school profile, assigns a school admin account, and configures GPS boundary and working hours.',
  },
  { num:'02', title:'Add Teachers', iconBg:'rgba(6,182,212,0.1)',
    svgProps:{ width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'var(--accent)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
    desc:'School admins register teachers with their profiles. Each teacher receives credentials and can download the ESA app.',
  },
  { num:'03', title:'GPS Check-In', iconBg:'rgba(16,185,129,0.1)',
    svgProps:{ width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'var(--success)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
    desc:'Teachers open the app and tap check-in. ESA verifies their GPS location against the school boundary and records the timestamp.',
  },
  { num:'04', title:'Live Dashboard', iconBg:'rgba(139,92,246,0.1)',
    svgProps:{ width:28,height:28,viewBox:'0 0 24 24',fill:'none',stroke:'var(--info)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    desc:'Admins see real-time attendance on a live map and dashboard. Reports are auto-generated, and auto-checkout handles end-of-day.',
  },
]

// ── Features ──────────────────────────────────────────────────
const features = [
  { title:'GPS Location Verification', iconBg:'rgba(37,99,235,0.1)',
    svgProps:{ width:26,height:26,viewBox:'0 0 24 24',fill:'none',stroke:'var(--primary)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
    desc:'Attendance is verified using precise GPS. Teachers must be within the school boundary — no proxy attendance possible.',
  },
  { title:'Wi-Fi Network Validation', iconBg:'rgba(6,182,212,0.1)',
    svgProps:{ width:26,height:26,viewBox:'0 0 24 24',fill:'none',stroke:'var(--accent)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    desc:'Optional Wi-Fi BSSID validation adds extra security. Teachers must be on the school network to check in.',
  },
  { title:'Real-Time Live Dashboard', iconBg:'rgba(16,185,129,0.1)',
    svgProps:{ width:26,height:26,viewBox:'0 0 24 24',fill:'none',stroke:'var(--success)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    desc:'Watch attendance live. Dashboard updates via WebSockets showing present, late, or absent the moment check-in is recorded.',
  },
  { title:'Automated Reports', iconBg:'rgba(245,158,11,0.1)',
    svgProps:{ width:26,height:26,viewBox:'0 0 24 24',fill:'none',stroke:'var(--warning)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/>',
    desc:'Generate daily, weekly, and monthly attendance reports with one click. Export to CSV for payroll or HR integration.',
  },
  { title:'Multi-School Management', iconBg:'rgba(139,92,246,0.1)',
    svgProps:{ width:26,height:26,viewBox:'0 0 24 24',fill:'none',stroke:'var(--info)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    desc:'Super admins manage unlimited schools from one central panel. Each school operates independently with its own settings.',
  },
  { title:'Auto-Checkout System', iconBg:'rgba(239,68,68,0.1)',
    svgProps:{ width:26,height:26,viewBox:'0 0 24 24',fill:'none',stroke:'var(--danger)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    desc:'Configure automatic end-of-day checkout times. Teachers who forget are handled automatically, keeping records clean.',
  },
]

// ── Download features ─────────────────────────────────────────
const mobileFeatures  = ['One-tap GPS check-in & check-out','View personal attendance history','Push notifications for reminders','Works offline, syncs when connected']
const desktopFeatures = ['Full dashboard — all admin features','Live map with teacher locations','Export reports to CSV','Multi-school control panel']

// ── Contact info ──────────────────────────────────────────────
const contactInfo = [
  { label:'Response Time', val:'Within 24–48 hours', bg:'rgba(37,99,235,0.1)',
    svgProps:{ width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'var(--primary)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16v.92z"/>',
  },
  { label:'Setup Process', val:'Guided onboarding, free', bg:'rgba(16,185,129,0.1)',
    svgProps:{ width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'var(--success)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  },
  { label:'Platform', val:'Mobile + Web + Desktop', bg:'rgba(6,182,212,0.1)',
    svgProps:{ width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'var(--accent)',['stroke-width']:1.8,['stroke-linecap']:'round',['stroke-linejoin']:'round' },
    svgPath:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>',
  },
]

// ── Contact form ──────────────────────────────────────────────
const form = reactive({ full_name:'', email:'', phone:'', school_name:'', message:'' })
const submitting = ref(false)
const formMsg    = ref(null)

async function submitContact() {
  submitting.value = true
  formMsg.value = null
  try {
    await api.post('/website/contact', { ...form })
    formMsg.value = { type:'success', text:'Request sent! Check your email for confirmation.' }
    Object.assign(form, { full_name:'', email:'', phone:'', school_name:'', message:'' })
  } catch(e) {
    const msg = e?.response?.data?.message || e?.message || 'Something went wrong. Please try again.'
    formMsg.value = { type:'error', text: msg }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* ═══════════════════════════════════
   CSS VARIABLES — match dashboard
═══════════════════════════════════ */
.esa-website {
  --primary:        #2563eb;
  --primary-dark:   #1d4ed8;
  --primary-light:  #3b82f6;
  --primary-glow:   rgba(37,99,235,0.28);
  --accent:         #06b6d4;
  --accent-dark:    #0891b2;
  --success:        #10b981;
  --success-dark:   #059669;
  --warning:        #f59e0b;
  --danger:         #ef4444;
  --info:           #8b5cf6;

  --bg:             #f0f4ff;
  --bg-secondary:   #e6edff;
  --surface:        rgba(255,255,255,0.88);
  --surface-hover:  rgba(255,255,255,0.98);
  --surface-border: rgba(37,99,235,0.11);
  --text:           #0f172a;
  --text-secondary: #475569;
  --text-muted:     #94a3b8;
  --card-shadow:    0 4px 24px rgba(37,99,235,0.09);
  --card-shadow-lg: 0 12px 48px rgba(37,99,235,0.14);
  --glass-blur:     18px;
  --font:           'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --radius-xs:  6px; --radius-sm: 8px; --radius: 14px; --radius-lg: 20px; --radius-xl: 28px;
  --transition: 0.22s cubic-bezier(0.4,0,0.2,1);

  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

.esa-website.dark {
  --bg:             #060c1a;
  --bg-secondary:   #0a1428;
  --surface:        rgba(13,25,58,0.88);
  --surface-hover:  rgba(20,40,82,0.95);
  --surface-border: rgba(59,130,246,0.16);
  --text:           #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted:     #475569;
  --card-shadow:    0 4px 32px rgba(0,0,0,0.5);
  --card-shadow-lg: 0 12px 56px rgba(0,0,0,0.6);
}

*, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
a { color:inherit; text-decoration:none; }
button { cursor:pointer; font-family:var(--font); }
img { max-width:100%; }

/* Glass */
.glass {
  background: var(--surface);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
}
.glass-lg {
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--card-shadow-lg);
}

/* Buttons */
.btn {
  display:inline-flex; align-items:center; justify-content:center;
  gap:8px; padding:10px 20px; border-radius:var(--radius-sm);
  font-weight:700; font-size:14px; border:none;
  transition:all var(--transition); cursor:pointer;
  white-space:nowrap; font-family:var(--font);
}
.btn-primary { background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; box-shadow:0 4px 16px var(--primary-glow); }
.btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 28px var(--primary-glow); }
.btn-primary:disabled { opacity:.7; cursor:not-allowed; transform:none; }
.btn-outline { background:transparent; color:var(--primary); border:1.5px solid rgba(37,99,235,0.4); }
.btn-outline:hover { background:var(--primary); color:#fff; }
.btn-ghost { background:var(--surface); color:var(--text-secondary); border:1px solid var(--surface-border); backdrop-filter:blur(12px); }
.btn-ghost:hover { color:var(--primary); border-color:rgba(37,99,235,.35); }
.btn-xl { padding:14px 30px; font-size:15px; border-radius:var(--radius); }

/* Layout */
.container { max-width:1160px; margin:0 auto; padding:0 24px; }
.section-pad { padding:96px 0; }
.gradient-text { background:linear-gradient(135deg,var(--primary),var(--accent)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.link-primary { color:var(--primary); font-weight:600; }
.link-primary:hover { text-decoration:underline; }

/* Section header */
.section-tag {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(37,99,235,0.1); color:var(--primary);
  padding:6px 14px; border-radius:99px; font-size:12px;
  font-weight:700; text-transform:uppercase; letter-spacing:.06em;
  border:1px solid rgba(37,99,235,0.2); margin-bottom:16px;
}
.section-title { font-size:clamp(26px,4vw,40px); font-weight:800; line-height:1.2; margin-bottom:14px; }
.section-desc  { font-size:16px; color:var(--text-secondary); max-width:520px; line-height:1.75; }
.mx-auto { margin:0 auto; }
.section-header-center { text-align:center; margin-bottom:48px; }

/* Orbs */
.orb { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; z-index:0; }

/* ══════════ NAV ══════════ */
.site-nav {
  position:fixed; top:0; left:0; right:0; z-index:1000;
  background:var(--surface);
  backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
  border-bottom:1px solid var(--surface-border);
  transition:all var(--transition);
}
.site-nav.scrolled { box-shadow:0 4px 24px rgba(0,0,0,0.08); }
.nav-inner { display:flex; align-items:center; justify-content:space-between; height:64px; max-width:1160px; margin:0 auto; padding:0 24px; }
.nav-brand { display:flex; align-items:center; gap:10px; }
.nav-logo  { width:36px; height:36px; border-radius:10px; object-fit:contain; }
.nav-name  { font-size:20px; font-weight:800; }
.nav-sub   { font-size:10px; color:var(--text-muted); font-weight:500; }
.nav-links { display:flex; align-items:center; gap:4px; }
.nav-link  { padding:7px 14px; border-radius:var(--radius-sm); font-size:14px; font-weight:500; color:var(--text-secondary); transition:all var(--transition); }
.nav-link:hover { background:rgba(37,99,235,0.08); color:var(--primary); }
.nav-link.active { color:var(--primary); font-weight:700; }
.nav-actions { display:flex; align-items:center; gap:10px; }
.theme-btn {
  width:38px; height:38px; border-radius:50%;
  border:1px solid var(--surface-border); background:var(--surface);
  color:var(--text-secondary); display:flex; align-items:center; justify-content:center;
  transition:all var(--transition);
}
.theme-btn:hover { color:var(--primary); border-color:var(--primary); }
.nav-cta { display:flex; align-items:center; gap:8px; }
.hamburger { display:none; flex-direction:column; gap:5px; width:38px; height:38px; align-items:center; justify-content:center; background:transparent; border:none; }
.hamburger span { width:22px; height:2px; background:var(--text); border-radius:2px; display:block; }

/* Mobile menu */
.mobile-menu {
  display:none; flex-direction:column; gap:4px;
  padding:12px 24px 20px;
  border-top:1px solid var(--surface-border);
  background:var(--surface);
}
.mobile-menu.open { display:flex; }
.mob-link { display:block; padding:11px 14px; border-radius:var(--radius-sm); font-size:15px; font-weight:500; color:var(--text-secondary); }
.mob-link:hover { background:rgba(37,99,235,0.08); color:var(--primary); }
.mob-cta  { display:flex; gap:10px; margin-top:10px; padding-top:12px; border-top:1px solid var(--surface-border); }

/* ══════════ HERO ══════════ */
.hero {
  padding:160px 0 100px; position:relative; overflow:hidden;
  background:linear-gradient(150deg,rgba(37,99,235,0.05) 0%,rgba(6,182,212,0.03) 60%,transparent 100%);
}
.hero-orb-1 { width:700px; height:700px; background:rgba(37,99,235,0.13); top:-200px; right:-150px; }
.hero-orb-2 { width:400px; height:400px; background:rgba(6,182,212,0.1); bottom:-100px; left:-100px; }
.hero-inner { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; position:relative; z-index:1; }
.hero-badge {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(37,99,235,0.1); border:1px solid rgba(37,99,235,0.22);
  padding:7px 16px; border-radius:99px; font-size:13px;
  font-weight:600; color:var(--primary); margin-bottom:22px;
}
.badge-dot { width:7px; height:7px; background:var(--accent); border-radius:50%; animation:pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
.hero-title { font-size:clamp(34px,5vw,56px); font-weight:900; line-height:1.1; margin-bottom:20px; }
.hero-desc  { font-size:17px; color:var(--text-secondary); line-height:1.75; margin-bottom:34px; max-width:460px; }
.hero-actions { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:44px; }
.hero-stats   { display:flex; gap:28px; flex-wrap:wrap; }
.hero-stat    {}
.hstat-val    { font-size:26px; font-weight:900; color:var(--primary); }
.hstat-lbl    { font-size:12px; color:var(--text-muted); font-weight:500; }

/* Hero card */
.hero-right { position:relative; }
.hero-card  { padding:24px; }
.hc-topbar  { display:flex; align-items:center; gap:8px; margin-bottom:18px; }
.hc-dots    { display:flex; gap:5px; }
.hc-dots span { width:10px; height:10px; border-radius:50%; display:block; }
.hc-title  { font-size:14px; font-weight:700; flex:1; }
.hc-live   { font-size:11px; font-weight:700; background:rgba(16,185,129,0.15); color:var(--success); padding:3px 10px; border-radius:99px; }
.hc-stats  { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
.hc-stat   { padding:12px; border-radius:var(--radius); background:rgba(37,99,235,0.07); text-align:center; border:1px solid var(--surface-border); }
.hcs-val   { font-size:20px; font-weight:800; }
.hcs-lbl   { font-size:10px; color:var(--text-muted); }
.hc-teachers { display:flex; flex-direction:column; gap:8px; }
.hc-teacher  { display:flex; align-items:center; gap:10px; padding:9px; border-radius:var(--radius-sm); background:rgba(37,99,235,0.04); }
.hc-av   { width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#fff; flex-shrink:0; }
.hc-tname { font-size:13px; font-weight:600; flex:1; }
.hc-status { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; }
.hc-status.present { background:rgba(16,185,129,0.15); color:var(--success); }
.hc-status.late    { background:rgba(245,158,11,0.15); color:var(--warning); }
.hc-status.absent  { background:rgba(239,68,68,0.12); color:var(--danger); }

/* Float cards */
.hero-float { position:absolute; padding:12px 16px; display:flex; align-items:center; gap:10px; border-radius:var(--radius); }
.hero-float-r { right:-24px; top:60px; }
.hero-float-l { left:-24px; bottom:80px; }
.float-ic  { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.float-lbl { font-size:10px; color:var(--text-muted); }
.float-val { font-size:14px; font-weight:800; }

/* ══════════ STATS BAR ══════════ */
.stats-bar       { background:linear-gradient(135deg,var(--primary),var(--primary-dark)); }
.stats-bar-inner { display:grid; grid-template-columns:repeat(4,1fr); align-items:center; padding:32px 24px; gap:16px; max-width:1160px; margin:0 auto; }
.sbar-item { display:flex; align-items:center; gap:12px; }
.sbar-icon { width:44px; height:44px; background:rgba(255,255,255,0.15); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.sbar-val  { font-size:20px; font-weight:800; color:#fff; }
.sbar-lbl  { font-size:12px; color:rgba(255,255,255,0.7); }

/* ══════════ HOW IT WORKS ══════════ */
.steps-grid {
  display:grid; grid-template-columns:repeat(4,1fr); gap:18px;
}
.step-card { padding:26px 22px; border-radius:var(--radius-lg); transition:all var(--transition); }
.step-card:hover { transform:translateY(-4px); box-shadow:var(--card-shadow-lg); }
.step-num  { font-size:44px; font-weight:900; line-height:1; background:linear-gradient(135deg,var(--primary),var(--accent)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom:14px; }
.step-icon-wrap { width:52px; height:52px; border-radius:var(--radius); display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
.step-title { font-size:16px; font-weight:700; margin-bottom:8px; }
.step-desc  { font-size:13px; color:var(--text-secondary); line-height:1.65; }

/* ══════════ FEATURES ══════════ */
.features-bg { background:linear-gradient(150deg,rgba(37,99,235,0.04) 0%,rgba(6,182,212,0.02) 100%); }
.features-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:48px; }
.feature-card { padding:26px; border-radius:var(--radius-lg); transition:all var(--transition); }
.feature-card:hover { transform:translateY(-4px); box-shadow:var(--card-shadow-lg); }
.feature-icon  { width:50px; height:50px; border-radius:var(--radius); display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
.feature-title { font-size:16px; font-weight:700; margin-bottom:8px; }
.feature-desc  { font-size:13px; color:var(--text-secondary); line-height:1.7; }

/* ══════════ DOWNLOAD ══════════ */
.download-bg { background:linear-gradient(150deg,rgba(37,99,235,0.06) 0%,rgba(6,182,212,0.03) 100%); }
.download-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-top:48px; }
.download-card { padding:30px 28px; border-radius:var(--radius-xl); display:flex; flex-direction:column; gap:18px; transition:all var(--transition); }
.download-card:hover { transform:translateY(-4px); box-shadow:var(--card-shadow-lg); }
.dc-header { display:flex; align-items:center; gap:16px; }
.dc-icon   { width:62px; height:62px; border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.dc-title    { font-size:20px; font-weight:800; }
.dc-subtitle { font-size:13px; color:var(--text-muted); }
.dc-features { display:flex; flex-direction:column; gap:9px; }
.dc-feat  { display:flex; align-items:center; gap:10px; font-size:14px; color:var(--text-secondary); }
.dc-check { width:20px; height:20px; border-radius:50%; background:rgba(16,185,129,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.dc-stores { display:flex; gap:10px; flex-wrap:wrap; }
.store-btn {
  display:flex; align-items:center; gap:10px; padding:11px 18px;
  background:var(--bg); border:1.5px solid var(--surface-border);
  border-radius:var(--radius); transition:all var(--transition); flex:1; min-width:130px;
}
.store-btn:hover { border-color:var(--primary); background:rgba(37,99,235,0.06); }
.store-icon    { flex-shrink:0; color:var(--text-secondary); }
.store-btn-sub  { font-size:10px; color:var(--text-muted); }
.store-btn-name { font-size:14px; font-weight:700; }
.download-note  { text-align:center; margin-top:24px; font-size:14px; color:var(--text-muted); }

/* ══════════ TRUSTED SCHOOLS ══════════ */
.trusted-wrap {
  overflow:hidden; margin-top:48px; position:relative;
}
.trusted-wrap::before,
.trusted-wrap::after {
  content:''; position:absolute; top:0; bottom:0; width:120px; z-index:2; pointer-events:none;
}
.trusted-wrap::before { left:0;  background:linear-gradient(to right,  var(--bg), transparent); }
.trusted-wrap::after  { right:0; background:linear-gradient(to left, var(--bg), transparent); }
.trusted-track {
  display:flex; gap:14px; animation:scroll-left 28s linear infinite;
  width:max-content; padding:10px 0;
}
.trusted-track:hover { animation-play-state:paused; }
@keyframes scroll-left { from{transform:translateX(0)} to{transform:translateX(-33.333%)} }

.school-badge {
  width:140px; height:78px; border-radius:var(--radius); display:flex; align-items:center;
  justify-content:center; padding:12px; position:relative; flex-shrink:0;
  transition:all var(--transition); cursor:default;
}
.school-badge:hover { transform:scale(1.06); box-shadow:var(--card-shadow-lg); }
.school-logo  { max-width:90px; max-height:46px; object-fit:contain; }
.school-initial-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; }
.school-initial { font-size:22px; font-weight:800; color:var(--primary); }
.school-short   { font-size:9px; color:var(--text-muted); text-align:center; }
.school-tooltip {
  position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);
  background:var(--text); color:var(--bg); font-size:11px; font-weight:600;
  padding:5px 10px; border-radius:6px; white-space:nowrap;
  opacity:0; transition:opacity var(--transition); pointer-events:none;
}
.school-badge:hover .school-tooltip { opacity:1; }

/* ══════════ CONTACT ══════════ */
.contact-bg  { background:linear-gradient(150deg,rgba(37,99,235,0.04) 0%,rgba(6,182,212,0.02) 100%); }
.contact-grid { display:grid; grid-template-columns:1fr 1.4fr; gap:56px; align-items:start; }
.contact-info-cards { display:flex; flex-direction:column; gap:12px; margin-top:28px; }
.ci-card { display:flex; align-items:center; gap:14px; padding:16px 18px; border-radius:var(--radius); }
.ci-icon  { width:44px; height:44px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.ci-label { font-size:11px; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
.ci-val   { font-size:15px; font-weight:600; }
.contact-form-card { padding:34px; border-radius:var(--radius-xl); }
.form-row   { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.form-group { display:flex; flex-direction:column; gap:6px; }
.form-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-secondary); }
.form-input {
  padding:11px 14px; background:var(--bg); border:1.5px solid var(--surface-border);
  border-radius:var(--radius-sm); color:var(--text); font-size:14px;
  font-family:var(--font); transition:all var(--transition); outline:none;
}
.form-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-glow); }
.form-input::placeholder { color:var(--text-muted); }
.form-msg {
  display:flex; align-items:center; gap:8px; padding:12px 16px;
  border-radius:var(--radius-sm); font-size:14px; font-weight:500;
}
.form-msg.success { background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:var(--success); }
.form-msg.error   { background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2);  color:var(--danger);  }

/* ══════════ FOOTER ══════════ */
.site-footer { border-top:1px solid var(--surface-border); background:var(--bg-secondary); padding:48px 0 28px; }
.footer-grid { display:grid; grid-template-columns:1.4fr 1fr 1fr 1fr; gap:36px; margin-bottom:36px; }
.footer-brand { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.footer-logo  { width:30px; height:30px; border-radius:8px; object-fit:contain; }
.footer-brand-name { font-size:18px; font-weight:800; }
.footer-tagline    { font-size:13px; color:var(--text-muted); line-height:1.65; max-width:220px; }
.footer-col-title  { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:12px; }
.footer-link  { display:block; font-size:14px; color:var(--text-secondary); margin-bottom:7px; transition:color var(--transition); }
.footer-link:hover { color:var(--primary); }
.footer-bottom { display:flex; align-items:center; justify-content:space-between; padding-top:22px; border-top:1px solid var(--surface-border); flex-wrap:wrap; gap:10px; }
.footer-copy   { font-size:13px; color:var(--text-muted); }
.footer-pills  { display:flex; gap:8px; flex-wrap:wrap; }
.footer-pill   { font-size:11px; font-weight:700; padding:4px 12px; border-radius:99px; background:rgba(37,99,235,0.1); color:var(--primary); border:1px solid rgba(37,99,235,0.2); }

/* ══════════ BACK TO TOP ══════════ */
.back-top {
  position:fixed; bottom:24px; right:28px; width:44px; height:44px;
  border-radius:50%; background:linear-gradient(135deg,var(--primary),var(--primary-dark));
  color:#fff; box-shadow:0 4px 16px var(--primary-glow);
  display:flex; align-items:center; justify-content:center;
  opacity:0; transform:translateY(10px); transition:all var(--transition);
  pointer-events:none; z-index:999; border:none;
}
.back-top.visible { opacity:1; transform:translateY(0); pointer-events:all; }
.back-top:hover   { transform:translateY(-3px); }

/* Spinner */
.spinner {
  width:18px; height:18px; border:2px solid rgba(37,99,235,.3);
  border-top-color:var(--primary); border-radius:50%;
  animation:spin .7s linear infinite; flex-shrink:0;
}
@keyframes spin { to { transform:rotate(360deg); } }

/* ══════════ RESPONSIVE ══════════ */
@media (max-width:900px) {
  .nav-links, .nav-cta { display:none; }
  .hamburger { display:flex; }
}
@media (max-width:1024px) {
  .steps-grid    { grid-template-columns:repeat(2,1fr); }
  .features-grid { grid-template-columns:repeat(2,1fr); }
}
@media (max-width:768px) {
  .section-pad { padding:64px 0; }
  .hero { padding:110px 0 64px; }

  /* Hero: stack vertically, card below text */
  .hero-inner { grid-template-columns:1fr; gap:36px; }
  .hero-right { order:2; /* card below text on mobile */ }
  .hero-float { display:none; }

  .steps-grid    { grid-template-columns:1fr 1fr; gap:14px; }
  .features-grid { grid-template-columns:1fr; }
  .download-grid { grid-template-columns:1fr; }
  .contact-grid  { grid-template-columns:1fr; gap:32px; }
  .footer-grid   { grid-template-columns:1fr 1fr; gap:24px; }
  .form-row      { grid-template-columns:1fr; }
  .hero-stats    { gap:18px; }
  .stats-bar-inner { grid-template-columns:repeat(2,1fr); gap:16px; padding:24px 20px; }
  .sbar-item { justify-content:flex-start; }
}
@media (max-width:480px) {
  .steps-grid  { grid-template-columns:1fr; }
  .footer-grid { grid-template-columns:1fr; }
  .footer-bottom { flex-direction:column; align-items:flex-start; }
  .hero-actions  { flex-direction:column; }
  .dc-stores { flex-direction:column; }
  .store-btn { flex:none; width:100%; }
}
</style>
