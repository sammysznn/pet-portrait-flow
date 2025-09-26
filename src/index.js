import { Hono } from "hono";
import { env } from "hono/adapter";
import Stripe from "stripe";
import OpenAI from "openai";

const app = new Hono();

const PORTRAIT_STYLES = {
  "realistic-painted": {
    label: "Realistic Painted Portrait 🎨",
    prompt: "Transform this pet photo into a grand oil painting on canvas. Use rich, painterly brush strokes, dramatic lighting, and luxurious fabrics. Keep the pet's likeness highly realistic and regal, with a timeless background inspired by classic portrait studios.",
  },
  "royal-costume": {
    label: "Royal / Costume Portrait 👑",
    prompt: "Dress this pet in an ornate royal costume—think crowns, epaulettes, embroidered cloaks, or historical uniforms. Pose them like aristocracy in a grand hall. Preserve the pet's face and expression while emphasizing playful royal details.",
  },
  "cartoon-pop": {
    label: "Cartoon & Pop Art 🐾",
    prompt: "Illustrate this pet as a vibrant cartoon or pop-art icon. Use bold outlines, saturated colors, and graphic shapes reminiscent of modern comic panels or Warhol prints. Maintain the pet's recognizable features while giving it energetic, stylized flair.",
  },
  "minimalist-line": {
    label: "Minimalist Line Art ✍️",
    prompt: "Convert this pet photo into elegant minimalist line art. Use clean, continuous lines or delicate contours set against a neutral background. Focus on silhouette and key details so the pet remains instantly identifiable while keeping the composition airy and modern.",
  },
  "fantasy-whimsical": {
    label: "Fantasy & Whimsical 🌌",
    prompt: "Reimagine this pet as a whimsical fantasy hero. Place them in a magical environment—think starlit skies, enchanted forests, or celestial scenes—and add imaginative wardrobe or props. Keep the pet's face true to life while amplifying the dreamy atmosphere.",
  },
};

const DEFAULT_PORTRAIT_STYLE = "realistic-painted";
const DIGITAL_PRICE_CENTS = 499;
const FRAMED_PRICE_CENTS = 2499;
const VALID_DELIVERY_OPTIONS = new Set(["digital", "framed"]);

function normalizeStyleArray(input) {
  if (!input) {
    return [];
  }
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      list = Array.isArray(parsed) ? parsed : [input];
    } catch (error) {
      list = input.includes(",") ? input.split(",") : [input];
    }
  }
  const unique = [];
  const seen = new Set();
  for (const raw of list) {
    const value = String(raw).trim();
    if (PORTRAIT_STYLES[value] && !seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}

function normalizeDeliveryArray(input) {
  if (!input) {
    return [];
  }
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      list = Array.isArray(parsed) ? parsed : [input];
    } catch (error) {
      list = input.includes(",") ? input.split(",") : [input];
    }
  }
  const unique = [];
  const seen = new Set();
  for (const raw of list) {
    const value = String(raw).trim();
    if (VALID_DELIVERY_OPTIONS.has(value) && !seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }
  return unique;
}

/**
 * Global middleware: configure Stripe and OpenAI clients per-request.
 */
app.use('*', async (context, next) => {
  const { STRIPE_API_KEY, OPENAI_API_KEY } = env(context);

  if (!STRIPE_API_KEY) {
    return context.text("Missing STRIPE_API_KEY environment variable", 500);
  }

  // Instantiate the Stripe client object.
  const stripe = new Stripe(STRIPE_API_KEY, {
    appInfo: {
      name: "stripe-samples/stripe-node-cloudflare-worker-template",
      version: "0.0.1",
      url: "https://github.com/stripe-samples",
    },
    maxNetworkRetries: 3,
    timeout: 30 * 1000,
  });

  context.set("stripe", stripe);

  if (OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    context.set("openai", openai);
  }

  await next();
});

app.get("/", (context) => {
  const html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Royal Pet Portrait Studio</title>
      <style>
        :root { color-scheme: light dark; }
        body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; background: radial-gradient(circle at top, #eef2ff 0%, #f6f9fc 35%, #fdfdfd 100%); color: #0a2540; }
        body::before { content: ""; position: fixed; inset: 0; pointer-events: none; background: radial-gradient(ellipse at top right, rgba(99,91,255,0.16), transparent 55%), radial-gradient(ellipse at bottom left, rgba(34,197,94,0.08), transparent 60%); z-index: 0; }
        a { color: inherit; }
        main { position: relative; z-index: 1; max-width: 1080px; margin: 0 auto; padding: 64px 24px 120px; display: grid; gap: 72px; }
        header { display: grid; gap: 32px; text-align: center; }
        header h1 { font-size: clamp(2.8rem, 4vw, 4rem); margin: 0; line-height: 1.05; letter-spacing: -0.03em; }
        header p { margin: 0 auto; max-width: 720px; font-size: 1.15rem; color: #425466; }
        header .cta-group { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
        .cta-primary { padding: 14px 28px; border-radius: 999px; border: none; background: linear-gradient(120deg, #635bff, #22c55e); color: #fff; font-weight: 600; cursor: pointer; font-size: 1rem; box-shadow: 0 18px 40px -24px rgba(99,91,255,0.8); transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 25px 60px -30px rgba(99,91,255,0.85); }
        .cta-secondary { border-radius: 999px; padding: 12px 26px; border: 1px solid rgba(99,91,255,0.2); background: rgba(255,255,255,0.6); font-weight: 600; color: #0a2540; backdrop-filter: blur(12px); cursor: pointer; transition: border 0.15s ease, transform 0.15s ease; }
        .cta-secondary:hover { border-color: rgba(99,91,255,0.4); transform: translateY(-1px); }
        .hero-preview { display: grid; gap: 24px; background: rgba(255,255,255,0.78); border-radius: 24px; padding: 28px; border: 1px solid rgba(99,91,255,0.18); box-shadow: 0 40px 80px -48px rgba(15,37,64,0.35); backdrop-filter: blur(22px); max-width: 880px; margin: 0 auto; text-align: left; }
        .hero-preview h2 { margin: 0; font-size: 1.5rem; }
        .pill-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .pill { padding: 8px 14px; border-radius: 999px; background: rgba(99,91,255,0.12); color: #333b66; font-size: 0.9rem; font-weight: 500; }
        section { display: grid; gap: 24px; }
        .section-title { font-size: clamp(1.8rem, 2.6vw, 2.4rem); margin: 0; text-align: center; }
        .features-grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .feature-card { border-radius: 20px; padding: 22px; background: rgba(255,255,255,0.85); border: 1px solid rgba(15,37,64,0.08); box-shadow: 0 18px 44px -32px rgba(15,37,64,0.28); display: grid; gap: 12px; }
        .feature-card strong { font-size: 1.05rem; }
        .feature-card p { margin: 0; color: #46556a; font-size: 0.96rem; }
        .pricing-band { border-radius: 24px; padding: 32px; background: linear-gradient(120deg, rgba(99,91,255,0.12), rgba(99,91,255,0.22)); display: grid; gap: 12px; text-align: center; border: 1px solid rgba(99,91,255,0.18); }
        .pricing-band h3 { margin: 0; font-size: 1.4rem; }
        .pricing-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        .price-card { padding: 18px; border-radius: 18px; background: rgba(255,255,255,0.88); border: 1px solid rgba(99,91,255,0.16); display: grid; gap: 6px; }
        .price-card span:first-child { font-weight: 600; color: #0a2540; }
        .price-card span:last-child { color: #46556a; font-size: 0.9rem; }
        .order-section { display: grid; gap: 32px; }
        .order-shell { display: grid; gap: 24px; background: rgba(255,255,255,0.92); border-radius: 24px; padding: 32px; border: 1px solid rgba(15,37,64,0.1); box-shadow: 0 40px 80px -48px rgba(15,37,64,0.35); backdrop-filter: blur(16px); }
        .order-shell h2 { margin: 0; font-size: clamp(2rem, 2.4vw, 2.4rem); }
        .order-shell p { margin: 0; color: #46556a; font-size: 1rem; }
        .form-grid { display: grid; gap: 24px; }
        form { display: grid; gap: 18px; }
        label { display: grid; gap: 8px; font-weight: 600; color: #192c54; }
        input[type="text"], input[type="email"], input[type="file"] { font: inherit; padding: 12px 14px; border: 1px solid rgba(15,37,64,0.12); border-radius: 12px; background: rgba(255,255,255,0.9); }
        input[type="file"] { padding: 6px; }
        fieldset { border: none; margin: 0; padding: 0; display: grid; gap: 14px; }
        legend { font-weight: 700; font-size: 1rem; color: #0a2540; }
        .styles-grid { display: grid; gap: 12px; }
        @media (min-width: 640px) { .styles-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .style-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid rgba(15,37,64,0.1); border-radius: 16px; background: rgba(248,249,255,0.9); transition: border 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
        .style-card:hover { border-color: rgba(99,91,255,0.65); box-shadow: 0 24px 48px -36px rgba(99,91,255,0.65); transform: translateY(-1px); }
        .style-card input { margin-top: 4px; }
        .style-card span { display: block; }
        .style-card span:first-child { font-weight: 600; color: #192c54; }
        .style-description { font-weight: 400; color: #4d5d80; font-size: 0.92rem; margin-top: 4px; }
        .delivery-options { display: grid; gap: 12px; }
        @media (min-width: 640px) { .delivery-options { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .delivery-card { display: flex; gap: 12px; align-items: center; padding: 16px; border-radius: 16px; border: 1px solid rgba(15,37,64,0.1); background: rgba(249,250,255,0.95); transition: border 0.15s ease, box-shadow 0.15s ease; }
        .delivery-card:hover { border-color: rgba(34,197,94,0.5); box-shadow: 0 20px 48px -36px rgba(34,197,94,0.35); }
        .delivery-card strong { font-size: 1rem; color: #0a2540; }
        .delivery-card span { color: #4d5d80; font-size: 0.92rem; }
        small.helper { color: #6a7a98; font-weight: 500; }
        #order-summary { border-radius: 18px; padding: 18px; border: 1px dashed rgba(99,91,255,0.3); background: rgba(241,243,255,0.7); display: grid; gap: 6px; font-size: 0.95rem; color: #1f2d50; }
        #order-summary span { display: block; }
        #summary-total { font-weight: 700; font-size: 1.05rem; }
        button { font: inherit; font-weight: 600; padding: 14px 20px; border-radius: 999px; border: none; cursor: pointer; background: linear-gradient(120deg, #635bff, #22c55e); color: #fff; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        button:hover { transform: translateY(-1px); box-shadow: 0 22px 46px -32px rgba(99,91,255,0.75); }
        button:disabled { opacity: .6; cursor: not-allowed; transform: none; box-shadow: none; }
        #status { min-height: 24px; color: #e44c4c; font-weight: 600; }
        #status.success { color: #0a8340; }
        #image-preview { width: 100%; max-height: 260px; object-fit: cover; border-radius: 16px; border: 1px dashed rgba(99,91,255,0.3); padding: 8px; display: none; background: rgba(246,248,255,0.9); }
        footer { text-align: center; color: #5a6a8c; font-size: 0.9rem; }
        footer a { color: #4d5dff; }
        @media (max-width: 720px) {
          main { padding: 48px 20px 96px; gap: 56px; }
          .hero-preview { padding: 24px; }
          .order-shell { padding: 24px; }
        }
      </style>
    </head>
    <body>
      <main>
        <header>
          <span style="display:inline-flex; align-items:center; gap:8px; justify-content:center; font-weight:600; color:#4f5d7a; background:rgba(255,255,255,0.6); border:1px solid rgba(99,91,255,0.2); padding:8px 16px; border-radius:999px; width:max-content; margin:0 auto;">Limited beta · AI-crafted pet portraits in under 5 minutes</span>
          <h1>Elevate your pet into a royal masterpiece</h1>
          <p>Inspired by Stack Auth’s clean aesthetic, our studio transforms your pet into museum-worthy artwork. Choose the styles you love, pay securely with Stripe, and receive digital or framed keepsakes crafted with OpenAI.</p>
          <div class="cta-group">
            <button class="cta-primary" data-scroll-to-form>Start Your Portrait</button>
            <button class="cta-secondary" data-scroll-to-form>See pricing & styles</button>
          </div>
          <div class="hero-preview">
            <h2>What’s included</h2>
            <div class="pill-list">
              <span class="pill">Up to 5 distinct art directions</span>
              <span class="pill">High-res 1024×1024 PNGs</span>
              <span class="pill">Ultra-fast AI rendering</span>
              <span class="pill">Optional framed delivery</span>
              <span class="pill">Secure Stripe checkout</span>
            </div>
            <p style="margin:0; color:#4b5c7d;">“It felt like ordering from a polished SaaS dashboard, but for pets. The framed version arrived looking like a real gallery piece.” — Casey R.</p>
          </div>
        </header>

        <section>
          <h2 class="section-title">Why pet parents love our studio</h2>
          <div class="features-grid">
            <div class="feature-card">
              <strong>Seamless experience</strong>
              <p>A single flow inspired by modern dashboards: share your details, pay, upload, and review every style in one place.</p>
            </div>
            <div class="feature-card">
              <strong>Styles that resonate</strong>
              <p>From royal regalia to minimalist line art, each preset has handcrafted prompt engineering to deliver consistent magic.</p>
            </div>
            <div class="feature-card">
              <strong>Flexible delivery</strong>
              <p>Instant digital downloads for just $4.99 per style, plus premium framed prints shipped to your door for $24.99 per style.</p>
            </div>
            <div class="feature-card">
              <strong>Fast, secure checkout</strong>
              <p>Built on Stripe Checkout with retry protection and webhook validation, so your payment is safe and smooth.</p>
            </div>
          </div>
        </section>

        <section class="pricing-band">
          <h3>Transparent pricing that scales with your imagination</h3>
          <p style="margin:0; color:#16294f;">Select as many styles as you want—each one is rendered separately so you can download or frame favorites.</p>
          <div class="pricing-grid">
            <div class="price-card">
              <span>Digital download</span>
              <span>$4.99 per style · Instant PNG delivery</span>
            </div>
            <div class="price-card">
              <span>Framed print</span>
              <span>$24.99 per style · 12"×16" gallery frame</span>
            </div>
            <div class="price-card">
              <span>Style expansion</span>
              <span>Realistic, royal, pop-art, minimalist, and fantasy presets included</span>
            </div>
          </div>
        </section>

        <section class="order-section" id="order">
          <div class="order-shell">
            <div style="display:grid; gap:12px;">
              <h2>Your portrait request</h2>
              <p>Tell us who we’re creating for, choose every art direction you want, and decide whether you’d like digital files, framed keepsakes, or both. You’ll upload the photo after checkout.</p>
            </div>
            <div class="form-grid">
              <div id="order-summary" hidden>
                <span id="summary-styles"></span>
                <span id="summary-delivery"></span>
                <span id="summary-total"></span>
              </div>
              <form id="order-form">
                <label>
                  First name
                  <input type="text" name="firstName" id="first-name" autocomplete="given-name" required />
                </label>
                <label>
                  Last name
                  <input type="text" name="lastName" id="last-name" autocomplete="family-name" required />
                </label>
                <label>
                  Email address
                  <input type="email" name="email" id="email" autocomplete="email" required />
                </label>
                <fieldset>
                  <legend>Choose your portrait styles</legend>
                  <div class="styles-grid">
                    <label class="style-card">
                      <input type="checkbox" name="styles" value="realistic-painted" checked />
                      <div>
                        <span>Realistic Painted Portrait 🎨</span>
                        <span class="style-description">Classic oil/acrylic realism with dramatic lighting.</span>
                      </div>
                    </label>
                    <label class="style-card">
                      <input type="checkbox" name="styles" value="royal-costume" />
                      <div>
                        <span>Royal / Costume Portrait 👑</span>
                        <span class="style-description">Dress your pet like a ruler, general, or folk hero.</span>
                      </div>
                    </label>
                    <label class="style-card">
                      <input type="checkbox" name="styles" value="cartoon-pop" />
                      <div>
                        <span>Cartoon & Pop Art 🐾</span>
                        <span class="style-description">Bold colors, comic outlines, and vibrant energy.</span>
                      </div>
                    </label>
                    <label class="style-card">
                      <input type="checkbox" name="styles" value="minimalist-line" />
                      <div>
                        <span>Minimalist Line Art ✍️</span>
                        <span class="style-description">Elegant single-line illustration for modern spaces.</span>
                      </div>
                    </label>
                    <label class="style-card">
                      <input type="checkbox" name="styles" value="fantasy-whimsical" />
                      <div>
                        <span>Fantasy & Whimsical 🌌</span>
                        <span class="style-description">Magical settings that turn pets into legends.</span>
                      </div>
                    </label>
                  </div>
                  <small class="helper">Pick as many as you’d like—we’ll render each one separately.</small>
                </fieldset>
                <fieldset>
                  <legend>Delivery options</legend>
                  <div class="delivery-options">
                    <label class="delivery-card">
                      <input type="checkbox" name="delivery" value="digital" checked />
                      <div>
                        <strong>Digital download</strong>
                        <span>High-res PNG delivered instantly — $4.99 per style.</span>
                      </div>
                    </label>
                    <label class="delivery-card">
                      <input type="checkbox" name="delivery" value="framed" />
                      <div>
                        <strong>Framed print</strong>
                        <span>Premium 12"×16" frame shipped to you — $24.99 per style.</span>
                      </div>
                    </label>
                  </div>
                  <small class="helper">Choose one or both options—pricing scales with your style count.</small>
                </fieldset>
                <label>
                  Pet photo
                  <input type="file" name="petImage" id="pet-image" accept="image/*" required />
                  <small class="helper">We’ll upload it after payment so you can confirm or swap the image.</small>
                </label>
                <img id="image-preview" alt="Selected pet preview" />
                <button type="submit" id="submit">Continue to secure payment</button>
                <div id="status" role="alert"></div>
              </form>
            </div>
          </div>
        </section>

        <footer>
          Built with ❤️ using Stripe Checkout, OpenAI Images, and Cloudflare Workers · © ${new Date().getFullYear()} Royal Pet Portrait Studio
        </footer>
      </main>
      <script>
        (function() {
          const DIGITAL_PRICE_CENTS = ${DIGITAL_PRICE_CENTS};
          const FRAMED_PRICE_CENTS = ${FRAMED_PRICE_CENTS};
          const form = document.getElementById('order-form');
          const status = document.getElementById('status');
          const fileInput = document.getElementById('pet-image');
          const styleInputs = Array.from(form.querySelectorAll('input[name="styles"]'));
          const deliveryInputs = Array.from(form.querySelectorAll('input[name="delivery"]'));
          const preview = document.getElementById('image-preview');
          const submitBtn = document.getElementById('submit');
          const summaryCard = document.getElementById('order-summary');
          const summaryStyles = document.getElementById('summary-styles');
          const summaryDelivery = document.getElementById('summary-delivery');
          const summaryTotal = document.getElementById('summary-total');
          const ctaButtons = Array.from(document.querySelectorAll('[data-scroll-to-form]'));
          const STORAGE_KEY = 'royal-pet-portrait';

          ctaButtons.forEach((btn) => {
            btn.addEventListener('click', (event) => {
              event.preventDefault();
              document.getElementById('order').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          });

          function showError(message) {
            status.textContent = message;
            status.classList.remove('success');
          }

          function showSuccess(message) {
            status.textContent = message;
            status.classList.add('success');
          }

          function fileToDataURL(file) {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
              reader.readAsDataURL(file);
            });
          }

          function getSelectedStyles() {
            return styleInputs.filter((input) => input.checked).map((input) => input.value);
          }

          function getSelectedDelivery() {
            return deliveryInputs.filter((input) => input.checked).map((input) => input.value);
          }

          function formatCurrency(cents) {
            return '$' + (cents / 100).toFixed(2);
          }

          function updateSummary() {
            const styles = getSelectedStyles();
            const delivery = getSelectedDelivery();
            if (!styles.length) {
              summaryCard.hidden = true;
              return;
            }
            summaryCard.hidden = false;
            const styleLabels = styles.map((value) => {
              const label = form.querySelector('input[name="styles"][value="' + value + '"] + div span:first-child');
              return label ? label.textContent : value;
            });
            summaryStyles.textContent = 'Styles: ' + styleLabels.join(', ');
            if (delivery.length) {
              const deliveryLabels = delivery.map((value) => {
                const node = form.querySelector('input[name="delivery"][value="' + value + '"] + div strong');
                return node ? node.textContent : value;
              });
              summaryDelivery.textContent = 'Delivery: ' + deliveryLabels.join(' · ');
              summaryDelivery.style.display = 'block';
              const total = (delivery.includes('digital') ? DIGITAL_PRICE_CENTS * styles.length : 0)
                + (delivery.includes('framed') ? FRAMED_PRICE_CENTS * styles.length : 0);
              summaryTotal.textContent = 'Estimated total: ' + formatCurrency(total);
            } else {
              summaryDelivery.style.display = 'none';
              summaryTotal.textContent = 'Select a delivery option to preview pricing.';
            }
          }

          styleInputs.forEach((input) => input.addEventListener('change', updateSummary));
          deliveryInputs.forEach((input) => input.addEventListener('change', updateSummary));

          async function handleSubmit(event) {
            event.preventDefault();
            status.textContent = '';
            submitBtn.disabled = true;

            const firstName = form.firstName.value.trim();
            const lastName = form.lastName.value.trim();
            const email = form.email.value.trim();
            const file = fileInput.files[0];
            const selectedStyles = getSelectedStyles();
            const selectedDelivery = getSelectedDelivery();

            if (!firstName || !lastName || !email) {
              showError('Please fill out your contact information.');
              submitBtn.disabled = false;
              return;
            }

            if (!selectedStyles.length) {
              showError('Pick at least one portrait style.');
              submitBtn.disabled = false;
              return;
            }

            if (!selectedDelivery.length) {
              showError('Select at least one delivery option.');
              submitBtn.disabled = false;
              return;
            }

            if (!file) {
              showError('Please choose a photo of your pet.');
              submitBtn.disabled = false;
              return;
            }

            try {
              const imageData = await fileToDataURL(file);
              const payload = {
                firstName,
                lastName,
                email,
                fileName: file.name,
                fileType: file.type,
                imageData,
                styles: selectedStyles,
                delivery: selectedDelivery,
              };
              let photoCached = true;
              try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
              } catch (storageError) {
                console.warn('Unable to cache full order payload', storageError);
                photoCached = false;
                const fallbackPayload = {
                  ...payload,
                  imageData: null,
                  imageTooLarge: true,
                };
                try {
                  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackPayload));
                } catch (secondaryError) {
                  console.warn('Unable to cache fallback order payload', secondaryError);
                }
                showError('Large photo detected — we’ll ask you to upload it again after checkout.');
              }

              const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ firstName, lastName, email, styles: selectedStyles, delivery: selectedDelivery }),
              });

              if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Unable to start checkout.' }));
                throw new Error(error.message || 'Unable to start checkout.');
              }

              const { url } = await response.json();
              if (!photoCached) {
                showSuccess('Redirecting to Stripe Checkout… we’ll prompt you to re-upload the photo after payment.');
              } else {
                showSuccess('Redirecting to Stripe Checkout…');
              }
              window.location.assign(url);
            } catch (error) {
              console.error(error);
              showError(error.message || 'Something went wrong starting checkout.');
              submitBtn.disabled = false;
            }
          }

          fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) {
              preview.style.display = 'none';
              preview.src = '';
              return;
            }
            try {
              const dataUrl = await fileToDataURL(file);
              preview.src = dataUrl;
              preview.style.display = 'block';
            } catch (error) {
              console.error(error);
              showError('Unable to preview that image. Please try a different file.');
            }
          });

          form.addEventListener('submit', handleSubmit);
          updateSummary();
        })();
      </script>
    </body>
  </html>`;

  return context.html(html);
});


app.get("/success", (context) => {
  const html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Payment complete – Upload your pet photo</title>
      <style>
        :root { color-scheme: light dark; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; background: #f6f9fc; color: #0a2540; }
        main { max-width: 720px; margin: 0 auto; padding: 48px 24px 64px; }
        h1 { margin-bottom: 8px; }
        p { margin-top: 0; color: #465870; }
        form { display: grid; gap: 16px; background: #fff; padding: 24px; border-radius: 16px; box-shadow: 0 24px 48px rgba(10,37,64,0.08); margin-top: 24px; }
        label { display: grid; gap: 8px; font-weight: 600; }
        input[type="file"] { font: inherit; padding: 6px; border: 1px solid #cfd7df; border-radius: 8px; }
        .styles-grid { display: grid; gap: 12px; }
        @media (min-width: 640px) { .styles-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .style-card { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid #d7e0eb; border-radius: 12px; background: #fdfdff; transition: border 0.15s ease, box-shadow 0.15s ease; }
        .style-card:hover { border-color: #635bff; box-shadow: 0 8px 24px rgba(99,91,255,0.12); }
        .style-card input { margin-top: 4px; }
        .style-card span { display: block; font-weight: 500; }
        .style-description { display: block; font-weight: 400; color: #62718b; font-size: 0.9rem; margin-top: 4px; }
        #style-summary { margin: 16px 0 0; font-size: 0.95rem; color: #465870; }
        #delivery-summary { margin: 8px 0 0; font-size: 0.95rem; color: #465870; }
        button { font: inherit; font-weight: 600; padding: 12px 16px; border-radius: 999px; border: none; cursor: pointer; background: #635bff; color: #fff; transition: background 0.15s ease, transform 0.15s ease; }
        button:hover { background: #5046e4; transform: translateY(-1px); }
        button:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        #status { min-height: 24px; color: #7a8da3; }
        #status.error { color: #e44c4c; }
        #status.success { color: #0a8340; }
        #preview { width: 100%; max-height: 240px; object-fit: contain; border-radius: 12px; border: 1px dashed #cfd7df; padding: 8px; display: none; background: #fafcff; }
        #result { margin-top: 32px; display: grid; gap: 16px; }
        #result-grid { display: grid; gap: 24px; }
        @media (min-width: 768px) { #result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        #result-grid figure { margin: 0; display: grid; gap: 12px; }
        #result-grid img { width: 100%; border-radius: 16px; box-shadow: 0 24px 48px rgba(10,37,64,0.12); }
        #result-grid figcaption { font-weight: 600; color: #0a2540; }
        #result-grid a { text-decoration: none; font-weight: 600; color: #635bff; }
      </style>
    </head>
    <body>
      <main>
        <h1>Payment confirmed 🎉</h1>
        <p>Upload your pet's photo below and we'll generate portraits in every style you picked.</p>
        <section id="status" role="status">Verifying your payment with Stripe…</section>
        <p id="style-summary" hidden></p>
        <p id="delivery-summary" hidden></p>
        <form id="upload-form" hidden>
          <input type="hidden" name="sessionId" id="session-id" />
          <input type="hidden" name="email" id="email" />
          <input type="hidden" name="firstName" id="first-name" />
          <input type="hidden" name="lastName" id="last-name" />
          <section>
            <h2 style="font-size: 1rem; margin: 0; font-weight: 600;">Select styles to generate now</h2>
            <p style="margin: 4px 0 12px; color: #62718b;">Uncheck any you want to skip for this run.</p>
            <div class="styles-grid" id="style-grid"></div>
          </section>
          <label>
            Pet photo
            <input type="file" name="petImage" id="pet-image" accept="image/*" />
            <small>We saved your original selection. Feel free to replace it.</small>
          </label>
          <img id="preview" alt="Pet preview" />
          <button type="submit" id="generate" disabled>Generate portraits</button>
        </form>
        <div id="result" hidden>
          <h2>Your portraits are ready 👑</h2>
          <div id="result-grid"></div>
        </div>
      </main>
      <script>
        (function() {
          const params = new URLSearchParams(window.location.search);
          const sessionId = params.get('session_id');
          const status = document.getElementById('status');
          const form = document.getElementById('upload-form');
          const sessionInput = document.getElementById('session-id');
          const emailInput = document.getElementById('email');
          const firstNameInput = document.getElementById('first-name');
          const lastNameInput = document.getElementById('last-name');
          const styleGrid = document.getElementById('style-grid');
          const fileInput = document.getElementById('pet-image');
          const preview = document.getElementById('preview');
          const generateBtn = document.getElementById('generate');
          const resultContainer = document.getElementById('result');
          const resultGrid = document.getElementById('result-grid');
          const styleSummary = document.getElementById('style-summary');
          const deliverySummary = document.getElementById('delivery-summary');
          const STORAGE_KEY = 'royal-pet-portrait';
          const STYLE_OPTIONS = {
            'realistic-painted': {
              label: 'Realistic Painted Portrait 🎨',
              description: 'Oil and acrylic inspired realism with regal lighting and rich textures.',
            },
            'royal-costume': {
              label: 'Royal / Costume Portrait 👑',
              description: 'Outfit your pet like royalty or a legendary hero with ornate costumes.',
            },
            'cartoon-pop': {
              label: 'Cartoon & Pop Art 🐾',
              description: 'Bold outlines and vibrant pop-art energy for a playful statement piece.',
            },
            'minimalist-line': {
              label: 'Minimalist Line Art ✍️',
              description: 'Elegant single-line art that pairs with clean, modern home décor.',
            },
            'fantasy-whimsical': {
              label: 'Fantasy & Whimsical 🌌',
              description: 'Dreamy, imaginative scenes that turn your pet into a magical legend.',
            },
          };
          const DELIVERY_OPTIONS = {
            digital: {
              label: 'Digital download',
              price: '$4.99 per style',
            },
            framed: {
              label: 'Framed print',
              price: '$24.99 per style',
            },
          };
          const DEFAULT_STYLE = 'realistic-painted';

          let storedData = null;
          const storedRaw = sessionStorage.getItem(STORAGE_KEY);
          if (storedRaw) {
            try {
              storedData = JSON.parse(storedRaw);
            } catch (error) {
              console.warn('Unable to restore stored order', error);
            }
          }
          if (storedData && storedData.style && !storedData.styles) {
            storedData.styles = [storedData.style];
          }
          if (storedData && storedData.delivery && !Array.isArray(storedData.delivery)) {
            storedData.delivery = [storedData.delivery];
          }

          const selectedStyles = new Set();
          let selectedDelivery = [];
          let hasPreviewImage = false;

          // Ensure the results panel starts hidden each visit.
          if (resultContainer) {
            resultContainer.hidden = true;
            resultGrid.innerHTML = '';
          }

          const presetStyles = normalizeStyles(storedData && storedData.styles);
          presetStyles.forEach((style) => selectedStyles.add(style));
          if (selectedStyles.size === 0) {
            selectedStyles.add(DEFAULT_STYLE);
          }

          selectedDelivery = normalizeDelivery(storedData && storedData.delivery);
          if (!selectedDelivery.length) {
            selectedDelivery = ['digital'];
          }

          hasPreviewImage = Boolean(storedData && storedData.imageData);
          if (hasPreviewImage && storedData && storedData.imageData) {
            preview.src = storedData.imageData;
            preview.style.display = 'block';
          }

          function normalizeStyles(value) {
            if (!value) return [];
            let list = [];
            if (Array.isArray(value)) {
              list = value;
            } else if (typeof value === 'string') {
              try {
                const parsed = JSON.parse(value);
                list = Array.isArray(parsed) ? parsed : [value];
              } catch (error) {
                list = value.includes(',') ? value.split(',') : [value];
              }
            }
            const unique = [];
            const seen = new Set();
            list.forEach((item) => {
              const trimmed = String(item).trim();
              if (STYLE_OPTIONS[trimmed] && !seen.has(trimmed)) {
                seen.add(trimmed);
                unique.push(trimmed);
              }
            });
            return unique;
          }

          function normalizeDelivery(value) {
            if (!value) return [];
            let list = [];
            if (Array.isArray(value)) {
              list = value;
            } else if (typeof value === 'string') {
              try {
                const parsed = JSON.parse(value);
                list = Array.isArray(parsed) ? parsed : [value];
              } catch (error) {
                list = value.includes(',') ? value.split(',') : [value];
              }
            }
            const unique = [];
            const seen = new Set();
            list.forEach((item) => {
              const trimmed = String(item).trim();
              if (DELIVERY_OPTIONS[trimmed] && !seen.has(trimmed)) {
                seen.add(trimmed);
                unique.push(trimmed);
              }
            });
            return unique;
          }

          function updateStyleSummary() {
            const styles = Array.from(selectedStyles);
            if (styles.length === 0) {
              styleSummary.hidden = false;
              styleSummary.textContent = 'Select at least one style to generate your portraits.';
            } else {
              const labels = styles.map((style) => STYLE_OPTIONS[style]?.label || style);
              styleSummary.hidden = false;
              styleSummary.textContent = 'Styles selected: ' + labels.join(', ');
            }
          }

          function updateDeliverySummary() {
            if (!selectedDelivery.length) {
              deliverySummary.hidden = true;
              return;
            }
            const details = selectedDelivery
              .map((value) => {
                const option = DELIVERY_OPTIONS[value];
                return option ? option.label + ' (' + option.price + ')' : null;
              })
              .filter(Boolean);
            if (!details.length) {
              deliverySummary.hidden = true;
              return;
            }
            deliverySummary.hidden = false;
            deliverySummary.textContent = 'Delivery: ' + details.join(' · ');
          }

          function updateGenerateState() {
            const hasStyles = selectedStyles.size > 0;
            generateBtn.disabled = !(hasStyles && hasPreviewImage);
          }

          function renderStyleGrid() {
            const html = Object.entries(STYLE_OPTIONS)
              .map(([value, data]) => {
                const checkedAttr = selectedStyles.has(value) ? ' checked' : '';
                return '<label class="style-card">'
                  + '<input type="checkbox" name="styles" value="' + value + '"' + checkedAttr + ' />'
                  + '<div>'
                  + '<span>' + data.label + '</span>'
                  + '<span class="style-description">' + data.description + '</span>'
                  + '</div>'
                  + '</label>';
              })
              .join('');
            styleGrid.innerHTML = html;
            const inputs = Array.from(styleGrid.querySelectorAll('input[name="styles"]'));
            inputs.forEach((input) => {
              input.addEventListener('change', () => {
                const { value, checked } = input;
                if (checked) {
                  selectedStyles.add(value);
                } else {
                  selectedStyles.delete(value);
                }
                updateStyleSummary();
                updateGenerateState();
              });
            });
          }

          if (!sessionId) {
            status.textContent = 'Missing checkout session ID. Please contact support.';
            status.classList.add('error');
            return;
          }

          async function dataURLToFile(dataUrl, fileName) {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            return new File([blob], fileName || 'pet-image.png', { type: blob.type || 'image/png' });
          }

          function showError(message) {
            status.textContent = message;
            status.classList.add('error');
            status.classList.remove('success');
          }

          function showSuccess(message) {
            status.textContent = message;
            status.classList.add('success');
            status.classList.remove('error');
          }

          async function verifyPayment() {
            try {
              const response = await fetch('/api/session-status?session_id=' + encodeURIComponent(sessionId));
              if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Unable to verify payment. Please contact support.' }));
                throw new Error(error.message || 'Unable to verify payment.');
              }

              const payload = await response.json();
              if (!payload.paid) {
                throw new Error('We were not able to verify your payment yet. Please wait a moment and refresh the page.');
              }

              sessionInput.value = sessionId;
              emailInput.value = payload.email || '';
              firstNameInput.value = payload.firstName || '';
              lastNameInput.value = payload.lastName || '';

              const sessionStyles = normalizeStyles(payload.styles);
              const storedStyles = normalizeStyles(storedData && storedData.styles);
              const combinedStyles = new Set([...sessionStyles, ...storedStyles]);
              if (combinedStyles.size === 0) {
                combinedStyles.add(DEFAULT_STYLE);
              }
              selectedStyles.clear();
              combinedStyles.forEach((style) => selectedStyles.add(style));
              renderStyleGrid();
              updateStyleSummary();
              updateSummary();

              const deliveryFromSession = normalizeDelivery(payload.delivery);
              const deliveryFromStorage = normalizeDelivery(storedData && storedData.delivery);
              selectedDelivery = deliveryFromSession.length ? deliveryFromSession : (deliveryFromStorage.length ? deliveryFromStorage : ['digital']);
              updateDeliverySummary();
              updateSummary();

              if (storedData && storedData.imageData) {
                preview.src = storedData.imageData;
                preview.style.display = 'block';
                hasPreviewImage = true;
              } else {
                hasPreviewImage = false;
                preview.src = '';
                preview.style.display = 'none';
              }

              // Reset any previous results when loading a fresh session.
              resultContainer.hidden = true;
              resultGrid.innerHTML = '';

              const needsReupload = !storedData || !storedData.imageData;
              let confirmationMessage = 'Payment confirmed. Upload (or confirm) your pet photo to continue.';
              if (storedData && storedData.imageTooLarge) {
                confirmationMessage = 'Payment confirmed. Please upload your pet photo again so we can transform it—larger files aren\'t cached automatically.';
              } else if (needsReupload) {
                confirmationMessage = 'Payment confirmed. Please upload your pet photo to start generating your portraits.';
              }
              status.textContent = confirmationMessage;
              status.classList.add('success');
              status.classList.remove('error');
              form.hidden = false;
              sessionStorage.removeItem(STORAGE_KEY);
              updateGenerateState();
              if (needsReupload) {
                showError('Upload your pet photo to continue — the image is not cached after checkout.');
              }
            } catch (error) {
              console.error(error);
              showError(error.message || 'Unable to verify payment.');
            }
          }

          renderStyleGrid();
          updateStyleSummary();
          updateDeliverySummary();
          updateSummary();
          updateGenerateState();

          fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) {
              preview.src = '';
              preview.style.display = 'none';
              hasPreviewImage = Boolean(storedData && storedData.imageData);
              updateGenerateState();
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              preview.src = reader.result;
              preview.style.display = 'block';
              hasPreviewImage = true;
              showSuccess('Photo attached. Generate your portraits when ready.');
              updateGenerateState();
            };
            reader.readAsDataURL(file);
          });

          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const stylesArray = Array.from(selectedStyles);
            if (stylesArray.length === 0) {
              showError('Please choose at least one style to generate.');
              updateGenerateState();
              return;
            }

            showSuccess('Generating your portraits… this can take a few moments.');
            generateBtn.disabled = true;

            const formData = new FormData(form);
            formData.delete('styles');
            stylesArray.forEach((style) => formData.append('styles', style));
            let file = formData.get('petImage');

            if (!file || (file instanceof File && file.size === 0)) {
              if (storedData && storedData.imageData) {
                try {
                  file = await dataURLToFile(storedData.imageData, storedData.fileName);
                  formData.set('petImage', file);
                } catch (error) {
                  console.warn('Unable to restore stored image', error);
                }
              }
            }

            if (!file || (file instanceof File && file.size === 0)) {
              showError('Please select the pet photo you would like us to transform.');
              generateBtn.disabled = false;
              return;
            }

            showSuccess('Generating your portraits… this can take a few moments.');
            resultContainer.hidden = true;
            resultGrid.innerHTML = '';
            try {
              const response = await fetch('/api/generate-portrait', {
                method: 'POST',
                body: formData,
              });
              if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Unable to generate portrait. Please try again.' }));
                throw new Error(error.message || 'Unable to generate portrait.');
              }

              const result = await response.json();
              const portraits = Array.isArray(result.portraits) ? result.portraits : [];
              if (!portraits.length) {
                throw new Error('We did not receive any portraits back from the studio.');
              }

              resultGrid.innerHTML = portraits
                .map(({ style, label, imageBase64 }, index) => {
                  const dataUrl = 'data:image/png;base64,' + imageBase64;
                  const fallbackLabel = 'Portrait ' + (index + 1);
                  const displayLabel = label || (STYLE_OPTIONS[style] && STYLE_OPTIONS[style].label) || fallbackLabel;
                  const downloadName = (style || 'pet-portrait') + '-' + (sessionId || 'session') + '.png';
                  return '<figure>'
                    + '<img src="' + dataUrl + '" alt="' + displayLabel + '" />'
                    + '<figcaption>' + displayLabel + '</figcaption>'
                    + '<a href="' + dataUrl + '" download="' + downloadName + '">Download this portrait</a>'
                    + '</figure>';
                })
                .join('');

              resultContainer.hidden = false;
              showSuccess('All done! Your portraits are ready.');
            } catch (error) {
              console.error(error);
              showError(error.message || 'Something went wrong generating your portraits.');
            } finally {
              generateBtn.disabled = false;
            }
          });

          verifyPayment();
        })();
      </script>
    </body>
  </html>`;

  return context.html(html);
});

app.post("/api/create-checkout-session", async (context) => {
  const stripe = context.get("stripe");

  let payload;
  try {
    payload = await context.req.json();
  } catch (error) {
    return context.json({ message: "Expected JSON payload." }, 400);
  }

  const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
  const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const styles = normalizeStyleArray(payload.styles);
  const delivery = normalizeDeliveryArray(payload.delivery);
  const digitalSelected = delivery.includes("digital");
  const framedSelected = delivery.includes("framed");

  if (!firstName || !lastName || !email) {
    return context.json({ message: "Missing required customer information." }, 400);
  }

  if (!styles.length) {
    return context.json({ message: "Select at least one portrait style." }, 400);
  }

  if (!digitalSelected && !framedSelected) {
    return context.json({ message: "Select at least one delivery option." }, 400);
  }

  const url = new URL(context.req.url);
  try {
    const styleLabels = styles.map((style) => PORTRAIT_STYLES[style]?.label ?? style);
    const lineItems = [];

    if (digitalSelected) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Digital pet portrait",
            description: `High-resolution PNG delivery. Styles: ${styleLabels.join(", ")}`.slice(0, 500),
          },
          unit_amount: DIGITAL_PRICE_CENTS,
        },
        quantity: styles.length,
      });
    }

    if (framedSelected) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Framed pet portrait",
            description: `Professionally framed print shipped to you. Styles: ${styleLabels.join(", ")}`.slice(0, 500),
          },
          unit_amount: FRAMED_PRICE_CENTS,
        },
        quantity: styles.length,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      metadata: {
        firstName,
        lastName,
        styles: JSON.stringify(styles),
        styleLabels: JSON.stringify(styleLabels),
        delivery: JSON.stringify(delivery),
        totalStyles: String(styles.length),
        includesDigital: digitalSelected ? "true" : "false",
        includesFramed: framedSelected ? "true" : "false",
      },
      line_items: lineItems,
      success_url: `${url.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url.origin}/?canceled=true`,
    });

    return context.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session error", error);
    const message = error && error.message ? error.message : "Unable to create checkout session.";
    return context.json({ message }, 500);
  }
});

app.get("/api/session-status", async (context) => {
  const stripe = context.get("stripe");
  const sessionId = context.req.query("session_id");

  if (!sessionId) {
    return context.json({ message: "Missing session_id query parameter." }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";
    const metadata = session.metadata || {};
    const styles = normalizeStyleArray(metadata.styles || metadata.style);
    let styleLabels = [];
    if (metadata.styleLabels) {
      try {
        const parsed = JSON.parse(metadata.styleLabels);
        if (Array.isArray(parsed)) {
          styleLabels = parsed.map((label) => String(label));
        }
      } catch (error) {
        styleLabels = [];
      }
    } else if (metadata.styleLabel) {
      styleLabels = [String(metadata.styleLabel)];
    }
    const delivery = normalizeDeliveryArray(metadata.delivery);

    return context.json({
      paid,
      email: session.customer_details && session.customer_details.email,
      firstName: metadata.firstName,
      lastName: metadata.lastName,
      styles,
      styleLabels,
      delivery,
    });
  } catch (error) {
    console.error("Stripe session retrieve error", error);
    const message = error && error.message ? error.message : "Unable to retrieve checkout session.";
    return context.json({ message }, 500);
  }
});

app.post("/api/generate-portrait", async (context) => {
  const stripe = context.get("stripe");
  const openai = context.get("openai");

  if (!openai) {
    return context.json({ message: "OpenAI is not configured." }, 500);
  }

  let formData;
  try {
    formData = await context.req.raw.formData();
  } catch (error) {
    return context.json({ message: "Expected multipart form-data." }, 400);
  }

  const sessionId = (formData.get("sessionId") || "").toString();
  const email = (formData.get("email") || "").toString();
  const firstName = (formData.get("firstName") || "").toString();
  const lastName = (formData.get("lastName") || "").toString();
  const petImage = formData.get("petImage");
  const rawStyles = formData.getAll("styles");

  if (!sessionId || !email || !petImage) {
    return context.json({ message: "Missing required form data." }, 400);
  }

  if (!(petImage instanceof File) || petImage.size === 0) {
    return context.json({ message: "A valid pet image file is required." }, 400);
  }

  const requestedStyles = normalizeStyleArray(rawStyles);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return context.json({ message: "Checkout session is not paid yet." }, 400);
    }
    const sessionEmail = session.customer_details && session.customer_details.email;
    if (sessionEmail && sessionEmail.toLowerCase() !== email.toLowerCase()) {
      return context.json({ message: "Session email does not match the submitted email." }, 400);
    }

    const metadata = session.metadata || {};
    const purchasedStyles = normalizeStyleArray(metadata.styles || metadata.style);
    const allowedStyles = new Set(purchasedStyles.length ? purchasedStyles : [DEFAULT_PORTRAIT_STYLE]);

    const uniqueStyles = requestedStyles.filter((style) => allowedStyles.has(style));
    if (!uniqueStyles.length) {
      uniqueStyles.push(...allowedStyles);
    }

    const persona = `${firstName || metadata.firstName || ""} ${lastName || metadata.lastName || ""}`.trim();
    const personaLine = persona ? ` Include a tasteful name plaque or inscription that reads \"${persona}\".` : "";

    const binary = await petImage.arrayBuffer();

    const portraits = [];
    for (const style of uniqueStyles) {
      const styleDetails = PORTRAIT_STYLES[style] || PORTRAIT_STYLES[DEFAULT_PORTRAIT_STYLE];
      const prompt = `${styleDetails.prompt} Use the provided pet photo strictly as a reference so the face, markings, and colors stay accurate.${personaLine}`;
      const imageFile = new File([binary], petImage.name || "pet-image.png", { type: petImage.type || "image/png" });

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: imageFile,
        prompt,
        size: "1024x1024",
        response_format: "b64_json",
      });

      const [image] = response.data || [];
      if (!image || !image.b64_json) {
        throw new Error("OpenAI did not return image data.");
      }

      portraits.push({
        style,
        label: styleDetails.label,
        imageBase64: image.b64_json,
      });
    }

    return context.json({ portraits });
  } catch (error) {
    console.error("Portrait generation error", error);
    const message = error && error.message ? error.message : "Failed to generate portrait.";
    return context.json({ message }, 500);
  }
});

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
