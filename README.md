# Network Intelligence

Network Intelligence is a high-performance, privacy-first tool for auditing your Instagram network. Upload your Instagram data exports and instantly generate a glass-rendered matrix of your connections — unrequited follows, fans, mutuals, historical drift, and outbound request activity. Everything is processed locally in your browser; no servers, no tracking.

## Features

* **Core Analysis**: Split your network into "Not Following Back," "Fans," and "Mutuals" using current Following & Followers data.
* **Time Machine (History)**: Compare old and current exports to track "Still Connected" accounts and "Disconnected" users (unfollowed, unfollowed-you, or deactivated).
* **Activity Log**: Grouped-by-date views for Pending Requests, Recent Follow Requests, and Recent Unfollowed, with stale-request highlighting (180+ days flagged).
* **Intelligent Sorting**: Toggle between alphabetical (A-Z / Z-A) and chronological (Oldest / Newest) sorting on every category.
* **Instant Search**: Filter thousands of usernames across any view; activity views also match by year or month.
* **Performance Built-In**: Virtualized lists render even the largest networks smoothly.
* **Quick Actions**: Copy any username to the clipboard or jump straight to their Instagram profile.
* **Liquid Glass UI**: Animated, glass-rendered dashboard with tabbed navigation.

## Getting Started

### Prerequisites

You need a recent version of [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Escgot/network-audit.git
   cd network-audit
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Building for production

```bash
npm run build
npm run preview
```

## Usage

1. Export your Instagram data using the platform's "Download Your Information" tool (or your platform's equivalent).
2. In the **Data Ingestion** popup, drop or click to upload your JSON files — any combination is supported:
   * `New Following` / `New Followers`
   * `Old Following` / `Old Followers`
   * `Pending Req` — `pending_follow_requests.json`
   * `Recent Req` / `Recent Unfollowed` — recent account activity files
3. Click **"Analyze Selection"** to compute your network matrix.
4. Use the tabbed navigation on the left to switch between **Core Network**, **Time Machine**, and **Activity Log** views.
5. Click **"Update Analysis"** if you upload new files during a session.

**Quick reference:**
| View | Requires | Reveals |
| --- | --- | --- |
| Core Network | New Following + New Followers | Not Following Back, Fans, Mutuals |
| Time Machine | Old + New files | Still Connected, Disconnected |
| Activity Log | Pending/Recent request files | Date-grouped outbound activity |

## Tech Stack

* **Framework**: React 19 + Vite
* **Styling**: Tailwind CSS
* **Animations**: Framer Motion
* **Icons**: Lucide React
* **Charts**: Recharts
* **Linting**: ESLint

## License

```
This project is open-source and available for personal use.
```