# SENTINEL — Intelligent Threat-Response Framework

**Problem Statement:** Develop an intelligent threat-response framework that
autonomously prioritizes and mitigates cyber threats in real time.

## Overview

SENTINEL ingests network/security event data, classifies each event into a
severity tier (**Benign → Low → Medium → High → Critical**) using a trained
RandomForest model (**99.4% accuracy**, macro F1 **0.976** on the real
**NSL-KDD** intrusion-detection dataset), and automatically assigns a
prioritized response action — from "log only" up to "block IP & isolate host
immediately." A live dashboard shows the autonomous triage-and-response
pipeline in action.

## Dataset

We use the **NSL-KDD** dataset (148,517 records combining KDDTrain+ and
KDDTest+), a widely-used benchmark for network intrusion detection. Each of
NSL-KDD's 22 real attack types (DoS, Probe, R2L, U2R) plus normal traffic is
mapped to one of our 5 severity tiers:

| NSL-KDD Category | Examples | Mapped Severity |
|---|---|---|
| normal | — | Benign |
| Probe | ipsweep, nmap, portsweep, satan | Low / Medium |
| DoS | neptune, smurf, back, teardrop | High |
| R2L | guess_passwd, ftp_write, warezmaster | High / Critical |
| U2R | buffer_overflow, rootkit, sqlattack | Critical |

`data/preprocess_nsl_kdd.py` performs this download-and-mapping step and
produces `data/threat_data.csv`, which feeds the training script unchanged.

## Architecture

```
data/          -> NSL-KDD raw files + preprocessing script + processed dataset (148,517 events)
notebooks/     -> model training script (RandomForest)
models/        -> trained model + encoders (.pkl)
backend/       -> FastAPI service (prediction + live feed API)
frontend/      -> React dashboard (live threat feed, severity charts, response log)
```

## How it works

1. **Feature extraction**: each event has 19 numeric/categorical features
   (connection counts, error rates, failed logins, file access patterns, etc.)
   taken directly from NSL-KDD's real network-traffic feature set.
2. **Classification**: a RandomForest (200 trees, balanced class weights)
   predicts severity tier + confidence score.
3. **Prioritization**: events are sorted by predicted severity — highest
   threats surface first, exactly as a SOC analyst would triage.
4. **Auto-response mapping**:
   | Severity | Action |
   |---|---|
   | Benign | Log only |
   | Low | Flag for review |
   | Medium | Throttle connection |
   | High | Isolate host & alert SOC |
   | Critical | Block IP & isolate host immediately |

## Running it

### Backend
```bash
cd backend
pip install fastapi uvicorn scikit-learn pandas joblib
uvicorn main:app --port 8000
```

### Frontend
Open `frontend/ThreatDashboard.jsx` in a React environment (or paste into a
Claude artifact / CodeSandbox / Vite app). It polls `http://localhost:8000`
for live data, and falls back to a built-in demo simulator if the backend
isn't reachable — so the demo always works even offline.

### Regenerate dataset / retrain model
```bash
python3 data/preprocess_nsl_kdd.py   # re-process NSL-KDD into threat_data.csv
python3 notebooks/train_model.py     # retrain RandomForest
```

## API Endpoints

- `POST /predict` — classify a single event
- `POST /predict_batch` — classify multiple events
- `GET /live_feed?n=10` — simulated real-time stream, auto-prioritized
- `GET /stats` — dataset-level severity distribution for charts
- `GET /sample_event` — random event with ground truth label

## Why this wins

- **Real ML on a real benchmark dataset**: trained on NSL-KDD (148K records,
  industry-standard IDS benchmark) — 99.4% accuracy, 0.976 macro F1. Judges
  can verify this is genuine, not hardcoded if-statements.
- **End-to-end autonomy**: detection → classification → prioritization →
  recommended action, all automatic.
- **Demo-ready**: live dashboard with real-time feed, severity breakdown,
  and an auto-response action log — visually compelling in a 3-minute pitch.
- **Extensible**: same pipeline works with CICIDS2017 or live traffic captures
  — just re-run the preprocessing step with a new feature mapping.

## Team Roles

- **Tech Lead**: ML model, backend API, integration (this repo)
- **Frontend**: Dashboard polish, animations, demo flow
- **Docs/Presentation**: Pitch deck, problem framing (SOC analyst burnout,
  response-time stats), demo script, README/documentation
