# Karthik Kumar portfolio

Static portfolio with a Three.js code tunnel, GSAP motion, a vector character animation, and a FastAPI SMTP contact endpoint. Vercel serves `public/` from its CDN and runs `app.py` as one Python Function.

## Local development

Python 3.12 is required.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
vercel dev
```

Run the backend tests with:

```powershell
python -m unittest discover -s tests -v
```

The SMTP tests mock the network. A real SMTP test requires the environment variables below and should only be run against an account authorized for this portfolio.

## Vercel deployment

1. Import this repository into one Vercel project or run `vercel --prod` from the repository root.
2. In Project Settings, add these variables to Production (and Preview if needed):

   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=465` for implicit TLS, or `587` for STARTTLS
   - `SMTP_USERNAME=<authenticated sender account>`
   - `SMTP_PASSWORD=<Google App Password or provider SMTP credential>`
   - `SMTP_FROM_EMAIL=<the authenticated sender address>`
   - `SMTP_TO_EMAIL=mkkarthik0609@gmail.com`

3. Redeploy after changing environment variables. Never use a regular Google account password.
4. Rate limit: see below.
5. Submit the live form once, confirm the API returns success, inspect Function logs, and confirm receipt separately in Gmail. SMTP acceptance does not prove inbox delivery.

The local `.env` is ignored. Existing Cloudflare variables are unused and should not be copied to Vercel.

## Character animation

`public/assets/character-animation.svg` holds the six frames of the supplied `gif.mp4` (368x368, 25/6 fps), auto-traced to vector paths and clipped to each frame's silhouette. `main.js` loads it, gives each frame its own `<svg>`, and GSAP dissolves between them on the clip's original 1.44 s loop (6 x 0.24 s). Rendering is resolution independent, so it stays sharp at 4K sizes; motion runs at the display's refresh rate. Reduced-motion visitors get the static "HI!" frame. No 4K/60 video file is produced or claimed.

The traced art is a posterised approximation of the painted source, not a pixel match. Regenerate it by re-running the trace on frames extracted with `ffmpeg -i gif.mp4 f%d.png`.

## Rate limiting

A Vercel Firewall rule limits `POST /api/contact` to 5 requests per 60 s per IP (deny). It lives in the project's firewall config, not in this repo.
