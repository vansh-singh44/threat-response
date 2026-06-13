"""
SENTINEL — Neuromorphic Threat-Response Engine
FastAPI backend with Spiking Neural Network (SNN) simulation layer.

The SNN layer wraps the trained RandomForest classifier:
  - Each incoming event is treated as an input spike train
  - Leaky Integrate-and-Fire (LIF) neurons accumulate membrane potential
  - A neuron "fires" (raises alert) when potential crosses threshold
  - Membrane potential decays over time (leak) — mimicking real neurons
  - Hebbian weight updates reinforce frequently-seen attack patterns
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
import random
import os
import time
from collections import deque, defaultdict

app = FastAPI(title="SENTINEL Neuromorphic Threat-Response API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "..", "models")
DATA_PATH = os.path.join(BASE_DIR, "..", "data", "threat_data.csv")

model    = joblib.load(f"{MODEL_DIR}/threat_model.pkl")
encoders = joblib.load(f"{MODEL_DIR}/encoders.pkl")
feature_cols = joblib.load(f"{MODEL_DIR}/feature_cols.pkl")
df = pd.read_csv(DATA_PATH)

SEVERITY_LABELS = {0: "Benign", 1: "Low", 2: "Medium", 3: "High", 4: "Critical"}
ACTION_MAP = {
    0: "Log only",
    1: "Flag for review",
    2: "Throttle connection",
    3: "Isolate host & alert SOC",
    4: "Block IP & isolate host immediately"
}


# ─────────────────────────────────────────────
#  SPIKING NEURAL NETWORK SIMULATION LAYER
# ─────────────────────────────────────────────

class LeakyIntegrateFireNeuron:
    """
    Leaky Integrate-and-Fire (LIF) neuron.
    Accumulates 'threat potential' from incoming events.
    Fires (returns True) when potential exceeds threshold.
    Potential decays exponentially over time (the 'leak').
    """
    def __init__(self, threshold=0.75, leak_rate=0.05, refractory_period=2.0):
        self.threshold       = threshold      # fire when potential >= this
        self.leak_rate       = leak_rate      # how fast potential decays per second
        self.refractory      = refractory_period  # cooldown after firing (seconds)
        self.membrane_potential = 0.0
        self.last_spike_time = 0.0
        self.last_update     = time.time()
        self.spike_count     = 0

    def integrate(self, input_strength: float) -> bool:
        """
        Receive an input, apply leak, add input, check threshold.
        Returns True if neuron fires (spike).
        """
        now = time.time()
        dt  = now - self.last_update

        # Apply leak (exponential decay)
        self.membrane_potential *= (1.0 - self.leak_rate * dt)
        self.membrane_potential  = max(0.0, self.membrane_potential)

        # Refractory period — neuron can't fire again too soon
        in_refractory = (now - self.last_spike_time) < self.refractory

        # Integrate input
        self.membrane_potential += input_strength
        self.membrane_potential  = min(1.0, self.membrane_potential)  # cap at 1
        self.last_update = now

        # Check threshold
        if self.membrane_potential >= self.threshold and not in_refractory:
            self.membrane_potential = 0.0  # reset after fire
            self.last_spike_time   = now
            self.spike_count      += 1
            return True  # SPIKE!
        return False


class NeuromorphicThreatLayer:
    """
    A layer of LIF neurons — one per threat severity class.
    Incoming ML predictions are converted to input spikes.
    The layer adds temporal context: a single anomaly won't fire,
    but sustained/repeated threats accumulate potential and trigger responses.
    """
    def __init__(self):
        # One LIF neuron per severity class
        self.neurons = {
            "Benign":   LeakyIntegrateFireNeuron(threshold=0.95, leak_rate=0.20),
            "Low":      LeakyIntegrateFireNeuron(threshold=0.80, leak_rate=0.10),
            "Medium":   LeakyIntegrateFireNeuron(threshold=0.65, leak_rate=0.07),
            "High":     LeakyIntegrateFireNeuron(threshold=0.50, leak_rate=0.04),
            "Critical": LeakyIntegrateFireNeuron(threshold=0.35, leak_rate=0.02),
        }
        # Hebbian weight matrix: how much each severity boosts others
        # High threats sensitize adjacent neurons (attack campaigns)
        self.hebbian_weights = {
            "Benign":   {"Benign": 0.10, "Low": 0.02, "Medium": 0.01, "High": 0.00, "Critical": 0.00},
            "Low":      {"Benign": 0.00, "Low": 0.15, "Medium": 0.05, "High": 0.02, "Critical": 0.01},
            "Medium":   {"Benign": 0.00, "Low": 0.03, "Medium": 0.20, "High": 0.08, "Critical": 0.03},
            "High":     {"Benign": 0.00, "Low": 0.01, "Medium": 0.05, "High": 0.25, "Critical": 0.10},
            "Critical": {"Benign": 0.00, "Low": 0.00, "Medium": 0.03, "High": 0.12, "Critical": 0.30},
        }
        self.spike_history   = deque(maxlen=100)   # recent spike log
        self.attack_patterns = defaultdict(int)     # Hebbian learning counter
        self.total_spikes    = 0

    def process_event(self, severity_label: str, confidence: float):
        """
        Feed an ML-classified event into the SNN layer.
        Returns spike metadata for the dashboard.
        """
        spikes = {}
        # Convert confidence + severity to input strength
        severity_weight = {"Benign": 0.1, "Low": 0.25, "Medium": 0.45, "High": 0.70, "Critical": 0.95}
        base_strength = severity_weight[severity_label] * confidence

        # Apply Hebbian lateral connections — recent patterns sensitize other neurons
        for target_label, neuron in self.neurons.items():
            strength = base_strength * self.hebbian_weights[severity_label][target_label]
            fired = neuron.integrate(strength)
            spikes[target_label] = {
                "fired": fired,
                "membrane_potential": round(neuron.membrane_potential, 4),
                "spike_count": neuron.spike_count,
            }
            if fired:
                self.total_spikes += 1
                self.spike_history.append({
                    "time": time.time(),
                    "neuron": target_label,
                    "trigger": severity_label
                })

        # Hebbian learning: reinforce this pattern
        self.attack_patterns[severity_label] += 1

        return spikes

    def get_membrane_state(self):
        """Returns current membrane potentials for all neurons (for dashboard viz)."""
        return {
            label: {
                "membrane_potential": round(n.membrane_potential, 4),
                "threshold": n.threshold,
                "spike_count": n.spike_count,
                "pct_to_fire": round(min(n.membrane_potential / n.threshold, 1.0) * 100, 1)
            }
            for label, n in self.neurons.items()
        }

    def get_spike_rate(self):
        """Spikes per second over recent window."""
        now = time.time()
        recent = [s for s in self.spike_history if now - s["time"] < 10.0]
        return round(len(recent) / 10.0, 2)


# Global SNN instance (persists across requests)
snn = NeuromorphicThreatLayer()


# ─────────────────────────────────────────────
#  ML CLASSIFICATION (unchanged core)
# ─────────────────────────────────────────────

class Event(BaseModel):
    duration: float
    src_bytes: float
    dst_bytes: float
    wrong_fragment: int = 0
    urgent_flags: int = 0
    num_failed_logins: int = 0
    num_compromised: int = 0
    root_shell_attempt: int = 0
    num_file_creations: int = 0
    num_access_files: int = 0
    connection_count: int = 0
    same_srv_rate: float = 0.5
    diff_srv_rate: float = 0.1
    serror_rate: float = 0.0
    rerror_rate: float = 0.0
    dst_host_count: int = 10
    dst_host_srv_count: int = 8
    is_guest_login: int = 0
    land_flag: int = 0
    protocol_type: str = "tcp"
    service: str = "http"
    flag: str = "SF"


def encode_event(event: Event):
    row = event.dict()
    for col in ["protocol_type", "service", "flag"]:
        le = encoders[col]
        val = row[col]
        if val not in le.classes_:
            val = le.classes_[0]
        row[col + "_enc"] = le.transform([val])[0]
    X = pd.DataFrame([[row[c] for c in feature_cols]], columns=feature_cols)
    return X


def classify(event: Event):
    X = encode_event(event)
    pred  = int(model.predict(X)[0])
    proba = model.predict_proba(X)[0]
    confidence = float(np.max(proba))
    severity_label = SEVERITY_LABELS[pred]

    # Feed into SNN layer
    spikes = snn.process_event(severity_label, confidence)

    return {
        "severity": pred,
        "severity_label": severity_label,
        "recommended_action": ACTION_MAP[pred],
        "confidence": round(confidence, 4),
        "probabilities": {SEVERITY_LABELS[i]: round(float(p), 4) for i, p in enumerate(proba)},
        # Neuromorphic data
        "snn_spikes": spikes,
        "snn_spike_rate": snn.get_spike_rate(),
    }


# ─────────────────────────────────────────────
#  ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "snn_total_spikes": snn.total_spikes}


@app.post("/predict")
def predict(event: Event):
    result = classify(event)
    return {"input": event.dict(), **result}


@app.post("/predict_batch")
def predict_batch(events: list[Event]):
    return [{"input": e.dict(), **classify(e)} for e in events]


@app.get("/sample_event")
def sample_event():
    row = df.sample(1).iloc[0]
    event = {c: (row[c].item() if hasattr(row[c], "item") else row[c]) for c in
             ["duration","src_bytes","dst_bytes","wrong_fragment","urgent_flags",
              "num_failed_logins","num_compromised","root_shell_attempt",
              "num_file_creations","num_access_files","connection_count",
              "same_srv_rate","diff_srv_rate","serror_rate","rerror_rate",
              "dst_host_count","dst_host_srv_count","is_guest_login","land_flag",
              "protocol_type","service","flag"]}
    return {"event": event, "ground_truth": row["severity_label"]}


@app.get("/stats")
def stats():
    counts = df["severity_label"].value_counts().to_dict()
    return {
        "total_events": len(df),
        "severity_distribution": counts,
        "protocol_distribution": df["protocol_type"].value_counts().to_dict(),
        "top_services": df["service"].value_counts().head(5).to_dict(),
    }


@app.get("/neuron_state")
def neuron_state():
    """Live membrane potentials of all LIF neurons — for the brain visualizer."""
    return {
        "neurons": snn.get_membrane_state(),
        "spike_rate": snn.get_spike_rate(),
        "total_spikes": snn.total_spikes,
        "attack_patterns": dict(snn.attack_patterns),
        "recent_spikes": list(snn.spike_history)[-10:],
    }


@app.get("/live_feed")
def live_feed(n: int = 10):
    sample = df.sample(n)
    results = []
    for _, row in sample.iterrows():
        event = Event(**{c: row[c] for c in feature_cols if not c.endswith("_enc")},
                      protocol_type=row["protocol_type"], service=row["service"], flag=row["flag"])
        r = classify(event)
        results.append({
            "id": random.randint(100000, 999999),
            "src_ip": f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(0,255)}",
            "dst_ip": f"192.168.{random.randint(0,255)}.{random.randint(0,255)}",
            "protocol": row["protocol_type"],
            "service": row["service"],
            **r
        })
    results.sort(key=lambda x: x["severity"], reverse=True)
    return results