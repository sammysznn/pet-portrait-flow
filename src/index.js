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
      <title>Royal Pet Portrait Checkout</title>
      <style>
        :root { color-scheme: light dark; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; background: #f6f9fc; color: #0a2540; }
        main { max-width: 720px; margin: 0 auto; padding: 48px 24px 64px; }
        h1 { margin-bottom: 16px; }
        p.lede { margin-top: 0; margin-bottom: 24px; font-size: 1.05rem; color: #465870; }
        form { display: grid; gap: 16px; background: #fff; padding: 24px; border-radius: 16px; box-shadow: 0 24px 48px rgba(10,37,64,0.08); }
        label { display: grid; gap: 8px; font-weight: 600; }
        input[type="text"], input[type="email"], input[type="file"] { font: inherit; padding: 10px 12px; border: 1px solid #cfd7df; border-radius: 8px; }
        input[type="file"] { padding: 6px; }
        .styles-grid { display: grid; gap: 12px; }
        @media (min-width: 640px) { .styles-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .style-card { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid #d7e0eb; border-radius: 12px; background: #fdfdff; transition: border 0.15s ease, box-shadow 0.15s ease; }
        .style-card:hover { border-color: #635bff; box-shadow: 0 8px 24px rgba(99,91,255,0.12); }
        .style-card input { margin-top: 4px; }
        .style-card span { display: block; font-weight: 500; }
        .style-description { display: block; font-weight: 400; color: #62718b; font-size: 0.9rem; margin-top: 4px; }
        .delivery-options { display: grid; gap: 12px; }
        .delivery-card { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid #d7e0eb; border-radius: 12px; background: #fdfdff; }
        .delivery-card strong { display: block; font-weight: 600; }
        .delivery-card span { color: #62718b; font-size: 0.9rem; }
        button { font: inherit; font-weight: 600; padding: 12px 16px; border-radius: 999px; border: none; cursor: pointer; background: #635bff; color: #fff; transition: background 0.15s ease, transform 0.15s ease; }
        button:hover { background: #5046e4; transform: translateY(-1px); }
        button:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        #status { min-height: 24px; color: #e44c4c; }
        #status.success { color: #0a8340; }
        #image-preview { width: 100%; max-height: 240px; object-fit: contain; border-radius: 12px; border: 1px dashed #cfd7df; padding: 8px; display: none; background: #fafcff; }
        small.helper { color: #7a8da3; font-weight: 400; }
      </style>
    </head>
    <body>
      <main>
        <h1>Create a Royal Pet Portrait</h1>
        <p class="lede">Tell us who you are and select your favorite photo of your pet. We'll collect payment via Stripe and then turn the photo into a majestic royal portrait with a little help from OpenAI.</p>
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
            <legend style="font-weight: 600; margin-bottom: 8px;">Choose your portrait styles</legend>
            <div class="styles-grid">
              <label class="style-card">
                <input type="checkbox" name="styles" value="realistic-painted" checked />
                <div>
                  <span>Realistic Painted Portrait 🎨</span>
                  <span class="style-description">Classic oil / acrylic look with museum-grade drama.</span>
                </div>
              </label>
              <label class="style-card">
                <input type="checkbox" name="styles" value="royal-costume" />
                <div>
                  <span>Royal / Costume Portrait 👑</span>
                  <span class="style-description">Dress your pet like nobility, generals, or iconic heroes.</span>
                </div>
              </label>
              <label class="style-card">
                <input type="checkbox" name="styles" value="cartoon-pop" />
                <div>
                  <span>Cartoon & Pop Art 🐾</span>
                  <span class="style-description">Bold color blocking, graphic outlines, and pop-art vibes.</span>
                </div>
              </label>
              <label class="style-card">
                <input type="checkbox" name="styles" value="minimalist-line" />
                <div>
                  <span>Minimalist Line Art ✍️</span>
                  <span class="style-description">Elegant single-line treatment for minimalist interiors.</span>
                </div>
              </label>
              <label class="style-card">
                <input type="checkbox" name="styles" value="fantasy-whimsical" />
                <div>
                  <span>Fantasy & Whimsical 🌌</span>
                  <span class="style-description">Enchanting scenes that turn pets into legendary heroes.</span>
                </div>
              </label>
            </div>
            <small class="helper">Pick as many as you’d like—we’ll generate each one.</small>
          </fieldset>
          <fieldset>
            <legend style="font-weight: 600; margin-bottom: 8px;">Delivery options</legend>
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
                  <span>Premium 12"x16" frame shipped to you — $24.99 per style.</span>
                </div>
              </label>
            </div>
            <small class="helper">You can grab the digital download, a framed keepsake, or both.</small>
          </fieldset>
          <label>
            Pet photo
            <input type="file" name="petImage" id="pet-image" accept="image/*" required />
            <small class="helper">We'll upload this after checkout to make your portrait.</small>
          </label>
          <img id="image-preview" alt="Selected pet preview" />
          <button type="submit" id="submit">Continue to secure payment</button>
          <div id="status" role="alert"></div>
        </form>
      </main>
      <script>
        (function() {
          const form = document.getElementById('order-form');
          const status = document.getElementById('status');
          const fileInput = document.getElementById('pet-image');
          const styleInputs = Array.from(form.querySelectorAll('input[name="styles"]'));
          const deliveryInputs = Array.from(form.querySelectorAll('input[name="delivery"]'));
          const preview = document.getElementById('image-preview');
          const submitBtn = document.getElementById('submit');
          const STORAGE_KEY = 'royal-pet-portrait';

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

          async function handleSubmit(event) {
            event.preventDefault();
            status.textContent = '';
            submitBtn.disabled = true;

            const firstName = form.firstName.value.trim();
            const lastName = form.lastName.value.trim();
            const email = form.email.value.trim();
            const file = fileInput.files[0];
            const selectedStyles = styleInputs.filter((input) => input.checked).map((input) => input.value);
            const selectedDelivery = deliveryInputs.filter((input) => input.checked).map((input) => input.value);

            if (!firstName || !lastName || !email) {
              showError('Please fill out your contact information.');
              submitBtn.disabled = false;
              return;
            }

            if (selectedStyles.length === 0) {
              showError('Pick at least one portrait style.');
              submitBtn.disabled = false;
              return;
            }

            if (selectedDelivery.length === 0) {
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
              sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

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
              showSuccess('Redirecting to Stripe Checkout…');
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

          const presetStyles = normalizeStyles(storedData && storedData.styles);
          presetStyles.forEach((style) => selectedStyles.add(style));
          if (selectedStyles.size === 0) {
            selectedStyles.add(DEFAULT_STYLE);
          }

          selectedDelivery = normalizeDelivery(storedData && storedData.delivery);
          if (!selectedDelivery.length) {
            selectedDelivery = ['digital'];
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

              const deliveryFromSession = normalizeDelivery(payload.delivery);
              const deliveryFromStorage = normalizeDelivery(storedData && storedData.delivery);
              selectedDelivery = deliveryFromSession.length ? deliveryFromSession : (deliveryFromStorage.length ? deliveryFromStorage : ['digital']);
              updateDeliverySummary();

              if (storedData && storedData.imageData) {
                preview.src = storedData.imageData;
                preview.style.display = 'block';
                hasPreviewImage = true;
              }

              status.textContent = 'Payment confirmed. Upload (or confirm) your pet photo to continue.';
              status.classList.add('success');
              status.classList.remove('error');
              form.hidden = false;
              sessionStorage.removeItem(STORAGE_KEY);
              updateGenerateState();
            } catch (error) {
              console.error(error);
              showError(error.message || 'Unable to verify payment.');
            }
          }

          renderStyleGrid();
          updateStyleSummary();
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
