import os
import time

LOG_FILE = "/var/log/auth.log"

def watch_logs():
    if not os.path.exists(LOG_FILE):
        print(f"Error: {LOG_FILE} not found.")
        return

    with open(LOG_FILE, "r") as f:
        f.seek(0, os.SEEK_END)
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.1)
                continue
            yield line

if __name__ == "__main__":
    for log in watch_logs():
        print(log)

