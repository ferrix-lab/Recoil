# Recoil

> ***System Tray // Active Recoil..***

Recoil is a modern, tactical-themed system utility built with **Tauri v2** and **React**. It allows you to instantly identify and terminate processes occupying specific network ports on your machine. With a sleek, dark-mode UI, it provides real-time visibility into your system's network activity and resource usage.

## Features

- **Live Port Monitoring**: Automatically scans and lists active TCP listeners.
- **Instant Termination**: "Sniper Button" to kill processes immediately by PID.
- **Smart Search**: Filter targets by Process ID (PID), Name (e.g., `node`, `python`), or Port number.
- **System Telemetry**: Real-time monitoring of CPU and Memory usage.
- **Tactical UI**: A focused, dark-themed interface built for developers who need speed and clarity.
- **Cross-Platform Core**: Built on Rust for performance and stability (currently optimized for macOS).

## Tech Stack

- **Frontend**:
  - React 19 (Vite)
  - TailwindCSS v4
  - Lucide React (Icons)
  - TanStack Query (Data Fetching)
- **Backend**:
  - Rust (Tauri v2)
  - `sysinfo` (System telemetry)
  - `lsof` (Port scanning)

## Prerequisites

Before running Recoil, ensure you have the following installed:

- **Node.js**: (v18 or newer recommended)
- **Rust**: (Latest stable)
- **Wait**... that's it! Tauri handles the rest.

## Development Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/recoil.git
    cd recoil
    ```

2.  **Install frontend dependencies:**
    ```bash
    npm install
    ```

3.  **Run the application in development mode:**
    ```bash
    npm run tauri dev
    ```
    This command will start the Vite dev server and launch the Tauri application window.

## Building for Production

To create an optimized application bundle:

```bash
npm run tauri build
```

The output binary/DMG will be available in `src-tauri/target/release/bundle/`.

## Troubleshooting

- **Permissions**: Recoil uses `lsof` to find open ports and `kill` to terminate processes. On macOS, this generally works fine for user-owned processes. Terminating system processes may require elevated privileges (running the app with `sudo`, though not recommended for GUI apps).
- **"Trait Bound" Errors**: If you encounter compilation errors related to `Serialize`, ensure your `src-tauri/src/main.rs` includes `use serde::Serialize;`.

## License

[MIT License](LICENSE)
