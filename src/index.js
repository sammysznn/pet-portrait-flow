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
        input[type="text"], input[type="email"], input[type="file"], select { font: inherit; padding: 10px 12px; border: 1px solid #cfd7df; border-radius: 8px; }
        input[type="file"] { padding: 6px; }
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
          <label>
            Portrait style
            <select name="style" id="style" required>
              <option value="realistic-painted" selected>Realistic Painted Portrait 🎨</option>
              <option value="royal-costume">Royal / Costume Portrait 👑</option>
              <option value="cartoon-pop">Cartoon & Pop Art 🐾</option>
              <option value="minimalist-line">Minimalist Line Art ✍️</option>
              <option value="fantasy-whimsical">Fantasy & Whimsical 🌌</option>
            </select>
            <small class="helper">Pick the vibe that fits your pet's personality.</small>
          </label>
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
          const styleSelect = document.getElementById('style');
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
            const style = styleSelect.value;

            if (!firstName || !lastName || !email) {
              showError('Please fill out your contact information.');
              submitBtn.disabled = false;
              return;
            }

            if (!style) {
              showError('Please choose your preferred portrait style.');
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
                style,
              };
              sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

              const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ firstName, lastName, email, style }),
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
        input[type="file"], select { font: inherit; padding: 6px; border: 1px solid #cfd7df; border-radius: 8px; }
        button { font: inherit; font-weight: 600; padding: 12px 16px; border-radius: 999px; border: none; cursor: pointer; background: #635bff; color: #fff; transition: background 0.15s ease, transform 0.15s ease; }
        button:hover { background: #5046e4; transform: translateY(-1px); }
        button:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        #status { min-height: 24px; color: #7a8da3; }
        #status.error { color: #e44c4c; }
        #status.success { color: #0a8340; }
        #preview { width: 100%; max-height: 240px; object-fit: contain; border-radius: 12px; border: 1px dashed #cfd7df; padding: 8px; display: none; background: #fafcff; }
        #result { margin-top: 32px; display: grid; gap: 16px; }
        #result img { width: 100%; border-radius: 16px; box-shadow: 0 24px 48px rgba(10,37,64,0.12); }
        a.download { text-decoration: none; font-weight: 600; color: #635bff; }
      </style>
    </head>
    <body>
      <main>
        <h1>Payment confirmed 🎉</h1>
        <p>Upload your pet's photo below and we'll generate a royal portrait just for you.</p>
        <section id="status" role="status">Verifying your payment with Stripe…</section>
        <p id="style-summary" hidden></p>
        <form id="upload-form" hidden>
          <input type="hidden" name="sessionId" id="session-id" />
          <input type="hidden" name="email" id="email" />
          <input type="hidden" name="firstName" id="first-name" />
          <input type="hidden" name="lastName" id="last-name" />
          <label>
            Portrait style
            <select name="style" id="style" required>
              <option value="realistic-painted">Realistic Painted Portrait 🎨</option>
              <option value="royal-costume">Royal / Costume Portrait 👑</option>
              <option value="cartoon-pop">Cartoon & Pop Art 🐾</option>
              <option value="minimalist-line">Minimalist Line Art ✍️</option>
              <option value="fantasy-whimsical">Fantasy & Whimsical 🌌</option>
            </select>
            <small>Feel free to tweak your style before we generate.</small>
          </label>
          <label>
            Pet photo
            <input type="file" name="petImage" id="pet-image" accept="image/*" />
            <small>We saved your original selection. Feel free to replace it.</small>
          </label>
          <img id="preview" alt="Pet preview" />
          <button type="submit" id="generate" disabled>Generate royal portrait</button>
        </form>
        <div id="result" hidden>
          <h2>Your royal portrait is ready 👑</h2>
          <img id="result-image" alt="Royal pet portrait" />
          <a id="download" class="download" download="royal-pet-portrait.png">Download the high resolution file</a>
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
          const styleSelect = document.getElementById('style');
          const fileInput = document.getElementById('pet-image');
          const preview = document.getElementById('preview');
          const generateBtn = document.getElementById('generate');
          const resultContainer = document.getElementById('result');
          const resultImage = document.getElementById('result-image');
          const downloadLink = document.getElementById('download');
          const styleSummary = document.getElementById('style-summary');
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

          function applyStyle(value) {
            const selected = STYLE_OPTIONS[value] ? value : DEFAULT_STYLE;
            styleSelect.value = selected;
            const data = STYLE_OPTIONS[selected];
            if (data) {
              styleSummary.hidden = false;
              styleSummary.textContent = data.label + ' – ' + data.description;
            } else {
              styleSummary.hidden = true;
            }
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

              const resolvedStyle = payload.style || (storedData && storedData.style) || DEFAULT_STYLE;
              applyStyle(resolvedStyle);
              if (storedData) {
                storedData.style = resolvedStyle;
              }

              if (storedData && storedData.imageData) {
                preview.src = storedData.imageData;
                preview.style.display = 'block';
                generateBtn.disabled = false;
              }

              status.textContent = 'Payment confirmed. Upload (or confirm) your pet photo to continue.';
              status.classList.add('success');
              status.classList.remove('error');
              form.hidden = false;
              generateBtn.disabled = false;
              sessionStorage.removeItem(STORAGE_KEY);
            } catch (error) {
              console.error(error);
              showError(error.message || 'Unable to verify payment.');
            }
          }

          applyStyle((storedData && storedData.style) || DEFAULT_STYLE);
          styleSelect.addEventListener('change', () => {
            applyStyle(styleSelect.value);
          });

          fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) {
              preview.src = '';
              preview.style.display = 'none';
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              preview.src = reader.result;
              preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
          });

          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            showSuccess('Generating your portrait… this can take a few moments.');
            generateBtn.disabled = true;

            const formData = new FormData(form);
            formData.set('style', styleSelect.value || DEFAULT_STYLE);
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
              const imageData = result.imageBase64;
              resultImage.src = 'data:image/png;base64,' + imageData;
              downloadLink.href = resultImage.src;
              resultContainer.hidden = false;
              showSuccess('All done! Enjoy your royal pet portrait.');
            } catch (error) {
              console.error(error);
              showError(error.message || 'Something went wrong generating your portrait.');
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
  const styleInput = typeof payload.style === "string" ? payload.style : "";
  const portraitStyle = PORTRAIT_STYLES[styleInput] ? styleInput : DEFAULT_PORTRAIT_STYLE;

  if (!firstName || !lastName || !email) {
    return context.json({ message: "Missing required customer information." }, 400);
  }

  const url = new URL(context.req.url);
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      metadata: {
        firstName,
        lastName,
        style: portraitStyle,
        styleLabel: PORTRAIT_STYLES[portraitStyle]?.label ?? portraitStyle,
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Royal Pet Portrait",
              description: "AI-crafted regal portrait of your beloved pet.",
            },
            unit_amount: 2500,
          },
          quantity: 1,
        },
      ],
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
    return context.json({
      paid,
      email: session.customer_details && session.customer_details.email,
      firstName: session.metadata && session.metadata.firstName,
      lastName: session.metadata && session.metadata.lastName,
      style: session.metadata && session.metadata.style,
      styleLabel: session.metadata && session.metadata.styleLabel,
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
    formData = await context.req.parseBody();
  } catch (error) {
    return context.json({ message: "Expected multipart form-data." }, 400);
  }

  const sessionId = typeof formData.sessionId === "string" ? formData.sessionId : "";
  const email = typeof formData.email === "string" ? formData.email : "";
  const firstName = typeof formData.firstName === "string" ? formData.firstName : "";
  const lastName = typeof formData.lastName === "string" ? formData.lastName : "";
  const petImage = formData.petImage;
  const styleInput = typeof formData.style === "string" ? formData.style : "";

  if (!sessionId || !email || !petImage) {
    return context.json({ message: "Missing required form data." }, 400);
  }

  if (!(petImage instanceof File) || petImage.size === 0) {
    return context.json({ message: "A valid pet image file is required." }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return context.json({ message: "Checkout session is not paid yet." }, 400);
    }
    const sessionEmail = session.customer_details && session.customer_details.email;
    if (sessionEmail && sessionEmail.toLowerCase() !== email.toLowerCase()) {
      return context.json({ message: "Session email does not match the submitted email." }, 400);
    }

    let style = PORTRAIT_STYLES[styleInput] ? styleInput : undefined;
    if (!style && session.metadata?.style && PORTRAIT_STYLES[session.metadata.style]) {
      style = session.metadata.style;
    }
    if (!style) {
      style = DEFAULT_PORTRAIT_STYLE;
    }

    const persona = `${firstName || session.metadata?.firstName || ''} ${lastName || session.metadata?.lastName || ''}`.trim();
    const styleDetails = PORTRAIT_STYLES[style] || PORTRAIT_STYLES[DEFAULT_PORTRAIT_STYLE];
    const personaLine = persona ? ` Include a tasteful name plaque or inscription that reads \"${persona}\".` : "";
    const prompt = `${styleDetails.prompt} Use the provided pet photo strictly as a reference so the face, markings, and colors stay accurate.${personaLine}`;

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: petImage,
      prompt,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const [image] = response.data || [];
    if (!image || !image.b64_json) {
      throw new Error("OpenAI did not return image data.");
    }

    return context.json({ imageBase64: image.b64_json });
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
