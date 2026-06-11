# Network Intelligence

Network Intelligence is a high-performance auditing tool designed to help you manage your social media connections. It allows you to analyze your following, follower, and pending request data to gain insights into your network growth, social hygiene, and relationship stability.

## Features

* **Core Analysis**: Identify "Not Following Back," "Fans," and "Mutuals" in your current network.
* **Time Machine (History)**: Compare your current network with historical data to track "Still Connected" accounts and "Disconnected" users (accounts that have unfollowed, been unfollowed, or deactivated).
* **Outbound Auditing**: Manage pending follow requests with chronological sorting to identify old, stale requests.
* **Intelligent Sorting**: Toggle between alphabetical (A-Z/Z-A) and chronological (Oldest/Newest) sorting for every data category.
* **Searchable Insights**: Filter through thousands of usernames instantly across any category. 
* **Interactive Dashboard**: Modular UI with tabbed navigation for a clean, focused experience.

## Getting Started

### Prerequisites

You need a recent version of [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone <https://github.com/Escgot/network-audit.git>
   cd network-intelligence
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```


3. Start the development server:
   ```bash
   npm run dev
   ```



## Usage

1. Export your data from your social media platform (e.g., Instagram "Download Your Information" tool).
2. Upload the required JSON files:
* `following.json` (Current & Old)
* `followers.json` (Current & Old)
* `pending_follow_requests.json`


3. Click **"Analyze Selection"** to generate your network matrix.
4. Use the navigation tabs to switch between **Core Network**, **Time Machine**, and **Outbound** views.
5. Click **"Update Analysis"** if you upload new files during a session.

## Tech Stack

* **Framework**: React.js
* **Styling**: Tailwind CSS
* **Animations**: Framer Motion
* **Icons**: Lucide React
* **Charts**: Recharts

## License

```
This project is open-source and available for personal use.
```
