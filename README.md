# VoIP AI Analyzer

AI-assisted VoIP trace analysis platform built with a Python backend and a React + Vite frontend.

The application allows users to upload PCAP files, analyze SIP/VoIP traffic, visualize call flows, and generate automated troubleshooting summaries.

## Features

* Upload and store PCAP traces
* Analyze SIP and VoIP traffic
* Generate AI-assisted summaries
* Visualize SIP call flows
* View analysis history and reports

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
http://localhost:3000
```

If the backend runs on a different port, update the frontend API configuration accordingly.

## Project Structure

```text
.
├── app/
│   ├── core/
│   └── main.py
├── src/
├── storage/
│   └── uploads/
├── requirements.txt
└── package.json
```

| Path               | Description                       |
| ------------------ | --------------------------------- |
| `app/`             | Backend application               |
| `src/`             | React frontend                    |
| `storage/uploads/` | Uploaded PCAP files               |
| `requirements.txt` | Python dependencies               |
| `package.json`     | Frontend dependencies and scripts |

## Configuration

### Environment Variables

If AI providers or external services are used, configure their API keys as environment variables before starting the backend.

Example:

```bash
OPENAI_API_KEY=your_api_key
```

### Frontend Cannot Connect to Backend

Verify that:

* The backend is running
* The API base URL is correct
* CORS settings are configured properly
* Frontend and backend ports match the configured values
