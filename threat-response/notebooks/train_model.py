"""
Trains a RandomForest classifier to predict threat_severity from network
event features. Saves the trained model + encoders for use by the backend API.
"""

import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score, f1_score

DATA_PATH = "/home/claude/threat-response/data/threat_data.csv"
MODEL_DIR = "/home/claude/threat-response/models"

def main():
    df = pd.read_csv(DATA_PATH)

    # Encode categorical columns
    cat_cols = ["protocol_type", "service", "flag"]
    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        df[col + "_enc"] = le.fit_transform(df[col])
        encoders[col] = le

    feature_cols = [
        "duration", "src_bytes", "dst_bytes", "wrong_fragment", "urgent_flags",
        "num_failed_logins", "num_compromised", "root_shell_attempt",
        "num_file_creations", "num_access_files", "connection_count",
        "same_srv_rate", "diff_srv_rate", "serror_rate", "rerror_rate",
        "dst_host_count", "dst_host_srv_count", "is_guest_login", "land_flag",
        "protocol_type_enc", "service_enc", "flag_enc"
    ]

    X = df[feature_cols]
    y = df["threat_severity"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=18,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    f1 = f1_score(y_test, preds, average="macro")

    print(f"Accuracy: {acc:.4f}")
    print(f"Macro F1: {f1:.4f}")
    print(classification_report(y_test, preds,
          target_names=["Benign", "Low", "Medium", "High", "Critical"]))

    # Feature importance (good for slide/demo)
    importances = pd.Series(model.feature_importances_, index=feature_cols)
    print("\nTop 8 important features:")
    print(importances.sort_values(ascending=False).head(8))

    # Save artifacts
    joblib.dump(model, f"{MODEL_DIR}/threat_model.pkl")
    joblib.dump(encoders, f"{MODEL_DIR}/encoders.pkl")
    joblib.dump(feature_cols, f"{MODEL_DIR}/feature_cols.pkl")
    print(f"\nSaved model + encoders to {MODEL_DIR}/")

if __name__ == "__main__":
    main()
