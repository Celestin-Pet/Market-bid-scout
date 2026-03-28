# 🚀 IT Opportunity Scout AI

**IT Opportunity Scout AI** is a powerful, full-stack market intelligence tool designed for IT companies to automate the discovery, analysis, and tracking of business opportunities. Powered by **Google Gemini AI**, it transforms raw portal data into actionable insights, helping you bid smarter and faster.

---

## 🌟 Key Features

- **Multi-Link AI Analysis**: Analyze up to **3 different portal URLs simultaneously**. The AI extracts project titles, descriptions, budgets, and deadlines in seconds.
- **Smart AI Matching**: Automatically compares found opportunities against your **Company Profile** and **Services** to provide a match score (0-100%) and a strategic summary.
- **Subscribed Portals (Max 10)**: Subscribe to your most valuable sources. The system uses AI to monitor these portals and sends **real-time notifications** when new opportunities "pop up."
- **Browsing History (7-Day Sync)**: Keeps a rolling 7-day history of every link you've analyzed. Easily subscribe to interesting portals or let the system auto-cleanup old data to keep your workspace lean.
- **Notification Center**: A dedicated hub for tracking all AI updates, new matches, and system alerts.
- **Persistent Storage**: Uses a local SQLite database to ensure your history, subscriptions, and analyzed opportunities are saved securely.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: Node.js (Express), TypeScript.
- **Database**: SQLite (via `better-sqlite3`).
- **AI Engine**: Google Gemini API (`@google/genai`).
- **Language**: 100% TypeScript.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your laptop:
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- A **Gemini API Key** (Get one for free at [Google AI Studio](https://aistudio.google.com/))

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
Open your terminal and run:
```bash
git clone <your-repository-url>
cd it-opportunity-scout
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory and add your Gemini API key:
```env
GEMINI_API_KEY="your_actual_api_key_here"
```


---

## 🚀 Running the Application

### Development Mode
To start the frontend and backend simultaneously with hot-reloading:
```bash
npm run dev
```
The application will be available at: **`http://localhost:3000`**

### Production Build
To build the app for production:
```bash
npm run build
npm start
```

---

## 🗄️ Data Management

The application stores all data in a local file named **`scout.db`**. 
- **Persistence**: Your data is saved locally on your laptop.
- **Cleanup**: The system automatically synchronizes and cleans up data older than 7 days to ensure you are always looking at the most relevant market opportunities.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request if you have ideas to make the Scout even more powerful.

---

## 📄 License

This project is licensed under the MIT License.

---

*Built with ❤️ and AI to help your IT business grow.*
