"""
Generates a synthetic cyber-threat dataset modeled on real intrusion-detection
features (similar style to NSL-KDD / CICIDS2017) but lightweight and
self-contained -- no external download needed, perfect for hackathon demos.

Each row = one network/security event.
Target = threat_severity (0=Benign, 1=Low, 2=Medium, 3=High, 4=Critical)
"""

import numpy as np
import pandas as pd

np.random.seed(42)

N = 20000

def gen():
    severity = np.random.choice([0, 1, 2, 3, 4], size=N, p=[0.55, 0.18, 0.14, 0.09, 0.04])

    data = {
        "duration": np.random.exponential(scale=2 + severity * 3, size=N),
        "src_bytes": np.random.exponential(scale=500 + severity * 2000, size=N),
        "dst_bytes": np.random.exponential(scale=300 + severity * 1000, size=N),
        "wrong_fragment": np.random.poisson(lam=severity * 0.4, size=N),
        "urgent_flags": np.random.poisson(lam=severity * 0.2, size=N),
        "num_failed_logins": np.random.poisson(lam=severity * 0.8, size=N),
        "num_compromised": np.random.poisson(lam=severity * 0.5, size=N),
        "root_shell_attempt": np.random.binomial(1, p=np.clip(severity * 0.12, 0, 1), size=N),
        "num_file_creations": np.random.poisson(lam=severity * 1.2, size=N),
        "num_access_files": np.random.poisson(lam=severity * 0.7, size=N),
        "connection_count": np.random.poisson(lam=5 + severity * 8, size=N),
        "same_srv_rate": np.clip(np.random.normal(0.6 - severity * 0.05, 0.15, size=N), 0, 1),
        "diff_srv_rate": np.clip(np.random.normal(0.1 + severity * 0.08, 0.1, size=N), 0, 1),
        "serror_rate": np.clip(np.random.normal(severity * 0.12, 0.1, size=N), 0, 1),
        "rerror_rate": np.clip(np.random.normal(severity * 0.08, 0.08, size=N), 0, 1),
        "dst_host_count": np.random.poisson(lam=10 + severity * 15, size=N),
        "dst_host_srv_count": np.random.poisson(lam=8 + severity * 10, size=N),
        "is_guest_login": np.random.binomial(1, p=np.clip(0.05 + severity * 0.05, 0, 1), size=N),
        "land_flag": np.random.binomial(1, p=np.clip(severity * 0.03, 0, 1), size=N),
    }

    protocol = np.random.choice(["tcp", "udp", "icmp"], size=N, p=[0.6, 0.3, 0.1])
    service = np.random.choice(
        ["http", "ftp", "ssh", "dns", "smtp", "telnet", "other"],
        size=N, p=[0.35, 0.1, 0.15, 0.15, 0.1, 0.05, 0.1]
    )
    flag = np.random.choice(["SF", "S0", "REJ", "RSTO"], size=N, p=[0.6, 0.2, 0.1, 0.1])

    df = pd.DataFrame(data)
    df["protocol_type"] = protocol
    df["service"] = service
    df["flag"] = flag
    df["threat_severity"] = severity

    severity_labels = {0: "Benign", 1: "Low", 2: "Medium", 3: "High", 4: "Critical"}
    df["severity_label"] = df["threat_severity"].map(severity_labels)

    # Recommended action mapping (used by backend for auto-response)
    action_map = {
        0: "Log only",
        1: "Flag for review",
        2: "Throttle connection",
        3: "Isolate host & alert SOC",
        4: "Block IP & isolate host immediately"
    }
    df["recommended_action"] = df["threat_severity"].map(action_map)

    return df

if __name__ == "__main__":
    df = gen()
    df.to_csv("/home/claude/threat-response/data/threat_data.csv", index=False)
    print(df["severity_label"].value_counts())
    print(df.head())
    print(f"\nSaved {len(df)} rows to threat_data.csv")
