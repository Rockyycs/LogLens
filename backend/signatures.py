import json

def load_signatures():
    try:
        with open('signatures.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def check_match(line, signatures):
    for category, patterns in signatures.items():
        if any(pattern in line.lower() for pattern in patterns):
            return category
    return None
