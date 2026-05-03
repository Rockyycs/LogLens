from detector import detect_threats
from parser import watch_logs

def main():
    print("🛡️ LogLens Active Defense Engine Started...")
    for line in watch_logs():
        threat = detect_threats(line)
        if threat:
            print(f"⚠️ THREAT DETECTED: {threat} | Log: {line.strip()}")

if __name__ == "__main__":
    main()
