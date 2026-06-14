# 🧠 SENTINEL — Neuromorphic Autonomous Threat-Response Engine

An AI-powered cybersecurity dashboard that combines machine learning with **brain-inspired spiking neural computation** to detect, prioritize, and autonomously respond to cyber threats in real time.

**Live demo:** https://threat-response.vercel.app

---

## 📌 Overview

SENTINEL classifies network security events into five severity tiers — **Benign, Low, Medium, High, Critical** — using a RandomForest model trained on the real-world **NSL-KDD** intrusion-detection dataset (148,517 records, 98% accuracy).

What makes SENTINEL different from a typical ML dashboard: every classified event feeds into a layer of **Leaky Integrate-and-Fire (LIF) neurons** — one per severity tier — that mimic how biological neurons accumulate "threat potential" and fire only once a threshold is crossed. The system uses **Hebbian learning** to strengthen connections between neurons that repeatedly fire together, allowing it to recognize coordinated attack campaigns without retraining the underlying model.

---

## 🧠 Neuromorphic Architecture

### Leaky Integrate-and-Fire (LIF) Neuron Layer
Each severity tier (Critical, High, Medium, Low, Benign) has its own LIF neuron with:
- **Membrane potential** that accumulates from incoming classified events
- **Leak rate** — potential decays exponentially over time, like a real neuron
- **Firing threshold (θ)** — Critical=0.35, High=0.50, Medium=0.65, Low=0.80, Benign=0.95
- **Refractory period** — a cooldown after firing before the neuron can fire again

### Hebbian Synaptic Weights
"Neurons that fire together, wire together." When a high-severity neuron fires, it sensitizes related neurons via a lateral weight matrix — so sustained or repeated attacks build up activation faster than isolated anomalies.

### Spike-Driven Auto-Response
A neuron firing (⚡) — not just an ML prediction — triggers the logged response action:

| Severity | Action |
|---|---|
| Benign | Log only |
| Low | Flag for review |
| Medium | Throttle connection |
| High | Isolate host & alert SOC |
| Critical | Block IP & isolate host immediately |

---

## 🚀 Dashboard Features

- 📡 **Live Threat Feed** — real-time, auto-prioritized network events with severity, confidence, and spike status
- 🧠 **LIF Neuron Layer Visualizer** — live membrane potentials, thresholds, and spike counts for all 5 neurons
- ⚡ **Neural Spike Train** — EEG-style strip showing system-wide neural firing activity
- 🔥 **Neural Activity Heatmap** — clustered view of recent event severity; bright clusters indicate coordinated attacks
- 📈 **Synaptic Weight Adaptation Graph** — visualizes Hebbian weight changes over time
- 🎯 **Threat Neuron Activation Score** — weighted activation across all neurons (0–100)
- 🧠 **Neuromorphic Learning Efficiency** — measures how actively the SNN layer is adapting to threat patterns
- 🔒 **Auto-Response Log** — every triggered action, tagged with whether the SNN spiked
- 🌐 **Animated Neural Background** — live particle network with traveling synaptic pulses

---

## 🏗️ Project Architecture

```
threat-response/
│
├── backend/          # FastAPI service — ML inference + SNN simulation layer
├── frontend/         # React + Vite dashboard
├── data/             # NSL-KDD dataset (preprocessed)
├── models/           # Trained RandomForest model + encoders
├── notebooks/        # Training scripts
└── README.md
```

---

## 🛠️ Tech Stack

**Frontend:** React, Vite, JavaScript (ES6+), Canvas API (neural background)
**Backend:** Python, FastAPI
**Machine Learning:** Scikit-Learn (RandomForest), Pandas, NumPy
**Dataset:** NSL-KDD (148,517 labeled network intrusion events)
**Deployment:** Vercel (frontend), local/uvicorn (backend)

---

## 📊 Model Performance

Trained on NSL-KDD with 22 real attack types mapped to 5 severity tiers (DoS, Probe, R2L, U2R → High/Critical; normal → Benign):

- **Accuracy:** 98.0%
- **Macro F1:** 0.90

---

## ▶️ Running Locally

### Backend
```bash
cd backend
pip install fastapi uvicorn scikit-learn pandas joblib numpy
uvicorn main:app --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — the dashboard polls the backend automatically and shows **LIVE · SNN ACTIVE** when connected. If the backend isn't running, it falls back to a built-in demo simulator.

---

## 🎯 Objectives

- Combine real ML classification with brain-inspired spiking neural computation
- Detect and prioritize threats with temporal context — not just single-event predictions
- Use Hebbian learning to adapt to attack campaigns without retraining
- Provide full transparency into the decision pipeline via live visualizations
- Reduce SOC response time through autonomous, spike-triggered actions

---

## 🔮 Future Enhancements

- Real neuromorphic hardware deployment (Intel Loihi / SpiNNaker)
- Larger SNN with multiple hidden layers and STDP learning rules
- Real-time API integrations with live network traffic (CICIDS2017, packet capture)
- SIEM platform integration
- Generative AI-powered incident summaries

---

## 👨‍💻 Author

**Vansh Singh**
Computer Science Engineering Student
Cybersecurity | AI | Data Analytics | Machine Learning

GitHub: https://github.com/vansh-singh44

---

## ⭐ If you found this project useful

Give this repository a star ⭐ and support the project.
