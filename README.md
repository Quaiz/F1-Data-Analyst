# F1 Data Analyst v2: Tactical Intelligence Dashboard

![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)
![FastF1](https://img.shields.io/badge/FastF1-3.4.0-red.svg)
![D3.js](https://img.shields.io/badge/D3.js-v7-F9A03C.svg)
![Gemini](https://img.shields.io/badge/AI-Gemini_2.5_Flash-8A2BE2.svg)

## Overview

**F1 Data Analyst v2** is a high-performance, real-time analytics platform engineered for Formula 1 telemetry and race pace analysis. Designed with a "Tactical/Mission Control" UI aesthetic inspired by specialized intelligence software (e.g., Palantir Gotham, Bloomberg Terminal), this system bridges the gap between raw data engineering and augmented AI analytics.

The platform ingests live and historical data directly from Formula 1's official timing endpoints via **FastF1**, processes it through a highly optimized **FastAPI** backend, and visualizes complex multidimensional datasets using **D3.js**. Furthermore, it integrates a proactive AI agent ("Quarky") powered by **Google Gemini 2.5 Flash** with real-time web grounding capabilities to deliver context-aware tactical insights.

---

## 🚀 Key Capabilities

### 1. High-Fidelity Data Visualization (EDA)
- **Direct Telemetry Head-to-Head:** Micro-level analysis of driver inputs mapping Speed, Throttle, Braking pressure, and Gear shifts across physical track distance (meters).
- **Pace Stability Distribution:** Granular statistical evaluation of stint consistency using **Boxplots** and **Violin plots**, rigorously filtering out anomalous laps (Safety Car, VSC, In/Out laps) to isolate true race pace.
- **Dynamic Time Evolution:** Lap-by-lap pace traces overlaid with tire compound history and interactive signal-smoothing algorithms to identify performance degradation (tire drop-off).
- **Geospatial Circuit Recon:** Interactive 2D track mapping and a 3D WebGL global deployment globe rendering real-world circuit coordinates and elevation data.

### 2. Augmented Analytics Pipeline
- **Context-Aware AI:** The system features an embedded LLM agent capable of interpreting on-screen data.
- **Search Grounding:** Through the `google-genai` SDK, the AI can perform real-time internet searches to retrieve live 2026+ championship standings, breaking news, or weather conditions, overcoming standard knowledge cutoff limitations.

### 3. Robust Backend Architecture
- **Dynamic Session Resolution:** Instead of relying on static scheduling, the backend dynamically queries Event Formats to gracefully handle Sprint Weekends versus Conventional Weekends.
- **Resilient Caching Strategy:** Aggressive file-based caching mechanism minimizes redundant requests to the F1 API, dramatically reducing latency and preventing rate-limiting.

---

## 🛠️ System Architecture & Tech Stack

- **Backend & Data Pipeline:** Python 3, FastAPI, FastF1, Pandas, NumPy, Uvicorn.
- **Artificial Intelligence:** Google GenAI SDK, Gemini 2.5 Flash (with Google Search tools).
- **Frontend Presentation:** Vanilla ES6 JavaScript, HTML5, Custom CSS3 Variables.
- **Visualization Engine:** D3.js (Data-Driven Documents), Chart.js, TopoJSON.

---

## ⚙️ Installation & Deployment

### Prerequisites
- Python 3.9 or higher.
- A valid Google Gemini API Key.

### Setup Instructions

1. **Clone the repository and install dependencies:**
   ```bash
   pip install fastapi uvicorn fastf1 pandas numpy google-genai
   ```

2. **Configure AI Credentials:**
   Locate `server.py` and inject your API key into the client instantiation (preferably via environment variables in production):
   ```python
   client = genai.Client(api_key="YOUR_GEMINI_API_KEY")
   ```

3. **Initialize the Backend Server:**
   ```bash
   python server.py
   ```
   *Note: The server incorporates an auto-kill script on port 8000 to ensure seamless restarts during active development on Windows environments.*

4. **Access the Dashboard:**
   Navigate to `http://127.0.0.1:8000` in any modern web browser.

---

## 📂 Project Structure

```text
F1 Dashboard/
├── server.py                 # FastAPI application, AI router, and Data ETL
├── main.js                   # Frontend controller and data hydration logic
├── index.html                # Tactical HUD DOM structure
├── style.css                 # Design system (Dark Mode, Glassmorphism, CSS Variables)
├── plot_*.js                 # Modular D3.js visualization components
│   ├── plot_telemetry.js     # Multiaxial line charts
│   ├── plot_racepace_box.js  # Interquartile range (IQR) analysis
│   └── ...                   
├── chat.js                   # AI Chatbot interface logic
└── cache/                    # FastF1 persistent cache directory (Ignored in VCS)
```

---

## ⚖️ Disclaimer
This project is unofficial and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V.
