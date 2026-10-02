# Smart Classroom Energy Conservation System

A front-end school science competition website demonstrating zone-based classroom energy management and an energy projection calculator.

## Run locally

Open `index.html` in a web browser. The website uses plain HTML, CSS, and JavaScript; no build step or package installation is required.

The device operating-time dashboard can read the optional local Python status service at `http://127.0.0.1:8765/status` when that service is running. The calculator's prototype measurement controls need that live status service; measured utilization is not stored when the page is refreshed.

## Files

- `index.html` — page structure and content
- `style.css` — responsive layout, visual styles, and animations
- `script.js` — calculator, live status polling, and animated background

The website does not directly connect to Arduino hardware.
