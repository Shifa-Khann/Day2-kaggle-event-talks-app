import os
import re
import html
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# In-memory cache for parsed release notes
CACHE_DURATION = 300  # Cache for 5 minutes
cache = {
    "data": None,
    "last_updated": 0
}

def clean_text_from_html(html_str):
    """Convert HTML string to clean, plain text for search and social sharing."""
    # Unescape HTML entities first
    text = html.unescape(html_str)
    # Remove script/style tags if any
    text = re.sub(r'<(script|style).*?>.*?</\1>', '', text, flags=re.IGNORECASE|re.DOTALL)
    # Replace common block elements with spaces to prevent squashing text
    text = re.sub(r'</?(p|li|ul|ol|div|br|h[1-6]|tr|td).*?>', ' ', text)
    # Strip any remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_release_notes():
    """Fetch and parse the BigQuery release notes XML feed."""
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Antigravity Release Notes Reader)'})
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
    except Exception as e:
        print(f"Error fetching BigQuery XML feed: {e}")
        # If cache exists, fall back to it
        if cache["data"] is not None:
            return cache["data"], True
        raise e

    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    parsed_items = []
    
    for entry in root.findall('atom:entry', ns):
        # Extract title (which acts as the date of release, e.g., "June 25, 2026")
        title_elem = entry.find('atom:title', ns)
        date_str = title_elem.text if title_elem is not None else "Unknown Date"
        
        # Extract updated timestamp
        updated_elem = entry.find('atom:updated', ns)
        updated_str = updated_elem.text if updated_elem is not None else ""
        
        # Extract ID
        id_elem = entry.find('atom:id', ns)
        id_str = id_elem.text if id_elem is not None else ""
        
        # Extract Link
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        link_href = link_elem.attrib.get('href') if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        # Extract Content HTML
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Each entry can contain multiple updates separated by <h3>Type</h3>
        # Format in BigQuery feed is usually: <h3>Feature</h3><p>...</p><h3>Change</h3><p>...</p>
        parts = re.split(r'<h3>(.*?)</h3>', content_html)
        
        # If there is content before the first h3, extract it as "Info"
        if parts[0].strip():
            intro_html = parts[0].strip()
            parsed_items.append({
                "id": f"{id_str}_intro",
                "date": date_str,
                "updated": updated_str,
                "type": "Info",
                "content_html": intro_html,
                "content_text": clean_text_from_html(intro_html),
                "link": link_href
            })
            
        for i in range(1, len(parts), 2):
            category = parts[i].strip()
            body_html = parts[i+1].strip() if i+1 < len(parts) else ""
            
            # Create a unique sub-id for this specific update item
            safe_category = re.sub(r'\W+', '_', category).lower()
            note_id = f"{id_str}_{safe_category}_{i}"
            
            parsed_items.append({
                "id": note_id,
                "date": date_str,
                "updated": updated_str,
                "type": category,
                "content_html": body_html,
                "content_text": clean_text_from_html(body_html),
                "link": link_href
            })
            
    return parsed_items, False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Return from cache if valid and refresh not forced
    if not force_refresh and cache["data"] is not None and (current_time - cache["last_updated"] < CACHE_DURATION):
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_updated": cache["last_updated"],
            "data": cache["data"]
        })
        
    try:
        data, fell_back = parse_release_notes()
        if not fell_back:
            cache["data"] = data
            cache["last_updated"] = current_time
            
        return jsonify({
            "status": "success",
            "source": "live" if not fell_back else "fallback_cache",
            "last_updated": cache["last_updated"],
            "data": data
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to retrieve release notes: {str(e)}"
        }), 500

if __name__ == '__main__':
    # Bind to all interfaces to allow local network testing
    app.run(host='127.0.0.1', port=5000, debug=True)
