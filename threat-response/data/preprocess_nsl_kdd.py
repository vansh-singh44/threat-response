"""
Preprocesses the NSL-KDD dataset into the SENTINEL severity-classification
schema used by our backend/model.

NSL-KDD has 41 features + attack-type label + difficulty score.
We:
  1. Load both KDDTrain+ and KDDTest+ and concatenate them.
  2. Map each attack_type label to one of our 5 severity tiers
     (Benign, Low, Medium, High, Critical) based on attack category
     and how dangerous/disruptive it typically is.
  3. Rename/select a subset of NSL-KDD columns that match our existing
     feature schema (so the backend Event model + training script work
     unchanged).
  4. Save as data/threat_data.csv (overwriting the synthetic dataset).
"""

import pandas as pd

NSL_DIR = "/home/claude/threat-response/data/nsl_kdd"
OUT_PATH = "/home/claude/threat-response/data/threat_data.csv"

# Official NSL-KDD column names (41 features + label + difficulty)
COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
    "land", "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in",
    "num_compromised", "root_shell", "su_attempted", "num_root",
    "num_file_creations", "num_shells", "num_access_files", "num_outbound_cmds",
    "is_host_login", "is_guest_login", "count", "srv_count", "serror_rate",
    "srv_serror_rate", "rerror_rate", "srv_rerror_rate", "same_srv_rate",
    "diff_srv_rate", "srv_diff_host_rate", "dst_host_count", "dst_host_srv_count",
    "dst_host_same_srv_rate", "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate", "dst_host_srv_diff_host_rate",
    "dst_host_serror_rate", "dst_host_srv_serror_rate",
    "dst_host_rerror_rate", "dst_host_srv_rerror_rate",
    "attack_type", "difficulty"
]

# --- Attack-type -> severity mapping ---
# Categories (standard NSL-KDD groupings):
#   DoS    : denial of service          -> High (disruptive, but well-understood/automatable response)
#   Probe  : surveillance/scanning       -> Low/Medium (reconnaissance, precursor to attack)
#   R2L    : remote-to-local             -> Critical (attacker gains local access from remote)
#   U2R    : user-to-root                -> Critical (privilege escalation, most dangerous)
#   normal : benign traffic              -> Benign

SEVERITY_MAP = {
    "normal": 0,  # Benign

    # Probe / surveillance -> Low or Medium depending on intrusiveness
    "ipsweep": 1, "nmap": 1, "portsweep": 1, "satan": 2, "saint": 2, "mscan": 2,

    # DoS -> High (service disruption, needs fast mitigation)
    "back": 3, "land": 3, "neptune": 3, "pod": 3, "smurf": 3, "teardrop": 3,
    "apache2": 3, "udpstorm": 3, "processtable": 3, "mailbomb": 3, "worm": 3,

    # R2L -> High to Critical (attacker is getting unauthorized remote access)
    "ftp_write": 3, "guess_passwd": 3, "imap": 3, "multihop": 4, "phf": 3,
    "spy": 4, "warezclient": 3, "warezmaster": 4, "xlock": 4, "xsnoop": 4,
    "snmpguess": 3, "snmpgetattack": 3, "httptunnel": 4, "sendmail": 3,
    "named": 4,

    # U2R -> Critical (privilege escalation = worst case)
    "buffer_overflow": 4, "loadmodule": 4, "perl": 4, "rootkit": 4,
    "ps": 4, "sqlattack": 4, "xterm": 4,
}

SEVERITY_LABELS = {0: "Benign", 1: "Low", 2: "Medium", 3: "High", 4: "Critical"}
ACTION_MAP = {
    0: "Log only",
    1: "Flag for review",
    2: "Throttle connection",
    3: "Isolate host & alert SOC",
    4: "Block IP & isolate host immediately"
}

# --- Columns we map into the existing SENTINEL feature schema ---
# (keeps backend/main.py and Event model compatible without changes)
FEATURE_RENAME = {
    "duration": "duration",
    "src_bytes": "src_bytes",
    "dst_bytes": "dst_bytes",
    "wrong_fragment": "wrong_fragment",
    "urgent": "urgent_flags",
    "num_failed_logins": "num_failed_logins",
    "num_compromised": "num_compromised",
    "root_shell": "root_shell_attempt",
    "num_file_creations": "num_file_creations",
    "num_access_files": "num_access_files",
    "count": "connection_count",
    "same_srv_rate": "same_srv_rate",
    "diff_srv_rate": "diff_srv_rate",
    "serror_rate": "serror_rate",
    "rerror_rate": "rerror_rate",
    "dst_host_count": "dst_host_count",
    "dst_host_srv_count": "dst_host_srv_count",
    "is_guest_login": "is_guest_login",
    "land": "land_flag",
    "protocol_type": "protocol_type",
    "service": "service",
    "flag": "flag",
}


def load_and_map(path):
    df = pd.read_csv(path, names=COLUMNS)

    # Map attack_type -> severity (drop rows with unmapped/unknown attack types)
    df["threat_severity"] = df["attack_type"].map(SEVERITY_MAP)
    unmapped = df["threat_severity"].isna().sum()
    if unmapped:
        print(f"  Dropping {unmapped} rows with unmapped attack types: "
              f"{sorted(df.loc[df['threat_severity'].isna(), 'attack_type'].unique())}")
    df = df.dropna(subset=["threat_severity"])
    df["threat_severity"] = df["threat_severity"].astype(int)

    # Select + rename to SENTINEL schema
    out = df[list(FEATURE_RENAME.keys()) + ["threat_severity"]].rename(columns=FEATURE_RENAME)

    out["severity_label"] = out["threat_severity"].map(SEVERITY_LABELS)
    out["recommended_action"] = out["threat_severity"].map(ACTION_MAP)
    return out


def main():
    print("Loading KDDTrain+...")
    train = load_and_map(f"{NSL_DIR}/KDDTrain+.txt")
    print("Loading KDDTest+...")
    test = load_and_map(f"{NSL_DIR}/KDDTest+.txt")

    df = pd.concat([train, test], ignore_index=True)
    print(f"\nTotal rows after mapping: {len(df)}")
    print(df["severity_label"].value_counts())

    df.to_csv(OUT_PATH, index=False)
    print(f"\nSaved combined NSL-KDD-based dataset to {OUT_PATH}")


if __name__ == "__main__":
    main()
