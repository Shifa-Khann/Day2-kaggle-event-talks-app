# BigQuery Release Notes Viewer & Twitter Share Hub 🚀

A modern developer dashboard built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that fetches live release notes from the Google Cloud BigQuery RSS/Atom XML feed. It allows developers to browse, search, filter updates by category (Features, Changes, Fixes, Deprecations), and compose X (Twitter) drafts that automatically adhere to the 280-character post limit.

---

## 🛠️ Tech Stack
* **Backend:** Python 3.x, Flask (v3.0)
* **Frontend:** Plain HTML5, Vanilla CSS3 (Custom Variables, Flexbox, Grid), Vanilla JavaScript (ES6+ Fetch API)
* **Icons:** FontAwesome (v6.4)
* **Fonts:** Google Fonts (Plus Jakarta Sans, Inter, Fira Code)

---

## ✨ Features
1. **Dynamic Feed Parser:** Fetches the official XML feed and splits single daily updates into category-specific note cards (Feature, Change, Fixed, Deprecated, Info).
2. **Short-Term Memory Cache:** Implements a 5-minute server-side in-memory cache to prevent rate-limiting Google's servers, with a force-refresh capability.
3. **Keyword Search & Filter badging:** Instant front-end keyword search and category filtering with auto-calculated update badges.
4. **Chronological Sorting:** Switch views between newest first and oldest first.
5. **Interactive Tweet Composer Modal:** Composes ready-to-post drafts of specific updates including metadata, text snippets, and deep links. It incorporates an exact 280-character count bar validation (following Twitter's rule where any URL counts as exactly 23 characters) and triggers X Web Intents.
6. **Full Responsiveness:** Tailored layouts for desktops, tablets, and mobile devices.

---

## 🚀 Getting Started

### Prerequisites
* Python 3.8+ installed on your system.

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Shifa-Khann/Day2-kaggle-event-talks-app.git
   cd Day2-kaggle-event-talks-app
   ```

2. **Create and activate a virtual environment:**
   * **Windows:**
     ```bash
     python -m venv .venv
     .venv\Scripts\activate
     ```
   * **macOS / Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the Flask application:**
   ```bash
   python app.py
   ```

5. **Open the browser:**
   Go to [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## 📂 Project Structure
```text
Day2-kaggle-event-talks-app/
│
├── static/
│   ├── css/
│   │   └── style.css      # Vanilla CSS styling with custom variables & gradients
│   └── js/
│       └── main.js        # Frontend state, filters, and Tweet composer controller
│
├── templates/
│   └── index.html         # Main dashboard markup and composer modal layout
│
├── .gitignore             # Git exclusion rules
├── app.py                 # Flask server, feed fetch, and XML parsing engine
├── README.md              # Project documentation
└── requirements.txt       # Python dependencies
```

---

## 📝 License
This project is open-source and available under the MIT License.
