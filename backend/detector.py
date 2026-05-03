import re

def detect_threats(line):
    line_lower = line.lower()
    threat_type = None
    
    # SQL Injection Detection
    if any(x in line_lower for x in ["select", "1=1", "--", "union"]):
        threat_type = "SQL_INJECTION"
    # Path Traversal Detection
    elif "../" in line_lower or "/etc/passwd" in line_lower:
        threat_type = "PATH_TRAVERSAL"
        
    return threat_type

if __name__ == "__main__":
    print("Detector Logic Loaded")
