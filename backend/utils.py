import subprocess

def block_ip(ip):
    try:
        subprocess.run(["sudo", "iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"], check=True)
        print(f"🛡️ ACTIVE DEFENSE: IP {ip} has been blocked via iptables.")
    except Exception as e:
        print(f"Error blocking IP: {e}")
