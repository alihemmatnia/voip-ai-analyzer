import paramiko
import io
import time
import socket

class SSHClientService:
    def __init__(self, host: str, port: int, username: str, password: str = None, ssh_key: str = None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.ssh_key = ssh_key
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    def connect(self):
        try:
            if self.ssh_key:
                # Use in-memory key file
                key_file = io.StringIO(self.ssh_key)
                try:
                    pkey = paramiko.RSAKey.from_private_key(key_file)
                except paramiko.SSHException:
                    key_file.seek(0)
                    pkey = paramiko.Ed25519Key.from_private_key(key_file)
                self.client.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    pkey=pkey,
                    timeout=5
                )
            else:
                self.client.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password,
                    timeout=5
                )
            return True, "Connected successfully"
        except paramiko.AuthenticationException:
            return False, "Authentication failed"
        except socket.timeout:
            return False, "Connection timed out"
        except Exception as e:
            return False, str(e)

    def execute_command(self, command: str) -> str:
        success, msg = self.connect()
        if not success:
            raise Exception(f"SSH Connection Failed: {msg}")

        try:
            stdin, stdout, stderr = self.client.exec_command(command, timeout=15)
            exit_status = stdout.channel.recv_exit_status()
            
            out = stdout.read().decode('utf-8')
            err = stderr.read().decode('utf-8')
            
            if exit_status != 0:
                return f"Error ({exit_status}):\n{err}\nOutput:\n{out}"
            return out
        finally:
            self.client.close()

    def get_latest_logs(self, lines: int = 200, platform: str = "Asterisk") -> str:
        """Fetch the tail of the log file based on PBX platform."""
        log_paths = {
            "Asterisk": "/var/log/asterisk/full",
            "FreeSWITCH": "/usr/local/freeswitch/log/freeswitch.log",
            "Kamailio": "/var/log/kamailio.log", # Varies by OS, could also be syslog
            "OpenSIPS": "/var/log/opensips.log"
        }
        path = log_paths.get(platform, "/var/log/syslog")
        return self.execute_command(f"tail -n {lines} {path}")
