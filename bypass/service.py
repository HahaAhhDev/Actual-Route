import asyncio
import json
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import curl_cffi
from curl_cffi import requests as cf_requests

app = FastAPI()

@app.post("/fetch")
async def fetch(request: Request):
    data = await request.json()
    url = data.get('url', '')
    method = data.get('method', 'GET')
    headers = data.get('headers', {})
    body = data.get('body', None)
    
    session = cf_requests.Session(impersonate="chrome120")
    
    try:
        response = session.request(
            method=method,
            url=url,
            headers=headers,
            data=body.encode() if body else None,
            stream=True,
            timeout=30,
            allow_redirects=True
        )
        
        def generate():
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk
        
        response_headers = {}
        for key, value in response.headers.items():
            if key.lower() not in ['content-encoding', 'transfer-encoding', 'connection']:
                response_headers[key] = value
        
        return StreamingResponse(
            generate(),
            status_code=response.status_code,
            headers=response_headers
        )
    except Exception as e:
        return {"error": str(e), "status": 500}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)