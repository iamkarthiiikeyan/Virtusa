# ATLAS — Autonomous Telecom Layout & Analytics System

## Prerequisites

- Python 3.12+
- Node.js 18+
- Google Earth Engine service account key (`gee-key.json`)

---

## Backend Setup

```bash
cd backend

pip install fastapi uvicorn pydantic python-dotenv osmnx networkx geopandas shapely numpy httpx earthengine-api scikit-learn

# Place your GEE service account key file here:
# backend/gee-key.json

uvicorn app.main:app --port 8000 --reload
```

## Frontend Setup

```bash
cd frontend

npm install

npm install zustand leaflet react-leaflet@4.2.1 @types/leaflet

npm run dev
```

## Access

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Google Earth Engine Setup (one-time)

```bash
cd backend

pip install earthengine-api

python setup_gee.py
```

1. Go to https://console.cloud.google.com/earth-engine/configuration?project=black-pier-490610-b0
2. Register project for Earth Engine (select Noncommercial)
3. Enable Earth Engine API: https://console.cloud.google.com/apis/library/earthengine.googleapis.com
4. Create service account: IAM & Admin → Service Accounts → Create
   - Name: `atlas-earth-engine`
   - Role: Editor
5. Create JSON key: Keys tab → Add Key → JSON → Download
6. Save as `backend/gee-key.json`

---

## Add Leaflet CSS

Add this line at the top of `frontend/src/index.css`:

```css
@import 'leaflet/dist/leaflet.css';
```



npx vite --force


admin@atlas.local / admin123