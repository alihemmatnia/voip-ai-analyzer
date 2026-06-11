# VoIP AI Analyzer

AI-assisted VoIP trace analysis platform built with a Python backend and a React + Vite frontend.

The application allows users to upload PCAP files and VoIP log files, analyze SIP/VoIP traffic, visualize call flows, and generate automated troubleshooting summaries powered by LLM.

## Features

* Upload and analyze PCAP traces (`.pcap`, `.pcapng`, `.cap` files)
* Upload and analyze VoIP logs (`.log`, `.txt` files)
* Automatic platform detection (Asterisk, FreeSWITCH, Kamailio, OpenSIPS, SBC)
* SIP traffic and error analysis
* RTP stream quality metrics (packet loss, jitter, codec)
* AI-assisted root cause analysis and recommendations
* Visualize SIP call flows with ladder diagrams
* View analysis history and comprehensive reports

## Supported Analysis Types

### PCAP Analysis
Upload packet capture files to perform deep network-level VoIP analysis:
- SIP signal flow reconstruction
- RTP media stream quality metrics (jitter, packet loss, gap detection)
- Codec negotiation and compatibility
- NAT traversal detection
- STUN/TURN/WebRTC protocol detection
- Comprehensive call quality scoring

### Log Analysis
Upload VoIP system logs to perform platform-aware analysis:
- **Supported Platforms**: Asterisk, FreeSWITCH, Kamailio, OpenSIPS, SBC
- Error and warning extraction
- Registration and authentication failure tracking
- SIP error code aggregation
- Network, RTP, codec, gateway, trunk, and timeout error detection
- AI-powered diagnostics and remediation recommendations

## Tech Stack

### Backend

* Python 3.10+
* FastAPI-style application
* PCAP processing and analysis engine

### Frontend

* React
* TypeScript
* Vite

## Prerequisites

* Python 3.10 or later
* Node.js 16 or later
* npm

## Getting Started

### Clone the Repository

```bash
git clone <repository-url>
cd voip-ai-analyzer
```

### Start the Backend

Install dependencies and start the backend:

```bash
pip install -r requirements.txt
python app/main.py
```

### Start the Frontend

From the project root:

```bash
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

If the backend runs on a different port, update the frontend API configuration accordingly.

## Usage Guide

### Analyzing PCAP Files

1. Open the web interface at `http://localhost:5173`
2. Click "Browse Files" or drag-and-drop a `.pcap`, `.pcapng`, or `.cap` file
3. Wait for background processing (see status polling)
4. View results including:
   - Call quality score and media stability metrics
   - Packet loss and jitter analysis
   - Negotiated codecs and NAT traversal status
   - SIP call flows with ladder diagrams
   - RTP stream statistics
   - AI-powered root cause analysis

### Analyzing VoIP Logs

1. Open the web interface at `http://localhost:5173`
2. Click "Browse Files" or drag-and-drop a `.log` or `.txt` file
3. The system automatically detects the platform (Asterisk, FreeSWITCH, Kamailio, OpenSIPS, SBC)
4. View results including:
   - Detected platform and error/warning counts
   - Top log events
   - SIP error code summary
   - AI-powered diagnostics with severity levels
   - Recommended remediation actions

## Project Structure

```text
.
├── app/
│   ├── core/
│   │   └── config.py
│   ├── db/
│   │   └── database.py
│   ├── models/
│   │   └── job.py
│   ├── api/
│   │   └── endpoints.py
│   ├── services/
│   │   └── analyzer.py
│   ├── llm/
│   │   └── llm_client.py
│   ├── parsers/
│   │   └── pcap_parser.py
│   ├── log_analyzers/
│   │   ├── detector.py
│   │   ├── parser.py
│   │   ├── patterns.py
│   │   └── service.py
│   └── main.py
├── src/
│   ├── components/
│   │   ├── AiAnalysisReport.tsx
│   │   ├── CallFlowLadder.tsx
│   │   └── LogAnalysisReport.tsx
│   └── types.ts
├── storage/
│   ├── uploads/
│   └── voip_analyzer.db
├── requirements.txt
└── package.json
```

| Path               | Description                       |
| ------------------ | --------------------------------- |
| `app/`             | Backend FastAPI application       |
| `app/log_analyzers/` | VoIP log parsing & platform detection |
| `app/parsers/`     | PCAP parsing & analysis           |
| `app/llm/`         | LLM integration for AI diagnostics |
| `src/`             | React + TypeScript frontend       |
| `storage/uploads/` | Uploaded PCAP and log files       |
| `requirements.txt` | Python dependencies               |
| `package.json`     | Frontend dependencies and scripts |

## API Endpoints

### Job Management

| Method | Endpoint                    | Description                      |
| ------ | --------------------------- | -------------------------------- |
| GET    | `/api/v1/jobs`              | List all analysis jobs           |
| GET    | `/api/v1/jobs/{job_id}`     | Get job status and details       |

### PCAP Analysis

| Method | Endpoint                    | Description                      |
| ------ | --------------------------- | -------------------------------- |
| POST   | `/api/v1/upload`            | Upload PCAP file for analysis    |
| GET    | `/api/v1/results/{job_id}`  | Get PCAP analysis results        |

### Log Analysis

| Method | Endpoint                           | Description                      |
| ------ | ---------------------------------- | -------------------------------- |
| POST   | `/api/v1/logs/upload`              | Upload log file for analysis     |
| GET    | `/api/v1/logs/results/{job_id}`    | Get log analysis results         |

## Configuration

### Environment Variables

Create a `.env` file in the project root to configure the application:

```bash
# Database
DATABASE_URL=sqlite:///./storage/voip_analyzer.db

# Upload directory
UPLOAD_DIR=./storage/uploads

# AI/LLM Provider (OpenAI-compatible API)
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_MODEL=gemma-3-12b-it
```

**Note**: The app uses a local LLM endpoint by default. To use OpenAI's API, update the configuration accordingly.

### Frontend Cannot Connect to Backend

Verify that:

* The backend is running
* The API base URL is correct
* CORS settings are configured properly
* Frontend and backend ports match the configured values

## Troubleshooting

### PCAP Analysis Issues

**"No SIP traffic found in PCAP"**
- Verify the PCAP file contains SIP protocol packets
- Check that the file wasn't corrupted during upload
- Ensure the network interfaces captured UDP/TCP traffic on ports 5060, 5061, or custom SIP ports

**"Call quality metrics are unavailable"**
- Ensure RTP streams are present in the PCAP
- Check for NAT/firewall configurations that may have affected RTP capture
- Verify that the VoIP endpoints sent media during the call

**"Ladder diagram shows no call flow"**
- Confirm SIP INVITE, 100 Trying, 180 Ringing, and 200 OK messages are captured
- Check for SIP message fragmentation or truncation

### Log Analysis Issues

**"Platform detection failed"**
- Verify the log file contains recognizable platform signatures
- Check that the file encoding is UTF-8
- Ensure logs contain timestamps and severity levels expected by the parser

**"No errors detected in logs"**
- Logs may represent a healthy system state (no errors)
- Check that the file contains actual VoIP PBX/SBC logs, not generic syslog output
- Review the "Error/Warning Count" section for actual event totals

**"AI analysis summary is incomplete"**
- Verify the LLM endpoint is configured and responding
- Check backend logs for LLM API errors
- Ensure sufficient context was extracted from the log file (very short logs may yield limited insights)

### General Issues

**"Database migration errors"**
- The application automatically adds missing schema columns on startup
- If errors persist, delete `./storage/voip_analyzer.db` and restart (will lose job history)

**"Upload fails with timeout"**
- Large files may exceed the processing timeout
- Check available disk space in `./storage/uploads/`
- Verify network connectivity and proxy settings

## License

This project is provided as-is for VoIP network analysis and troubleshooting purposes.

## Contributing

Contributions are welcome. Please submit issues and pull requests to improve the analyzer.
