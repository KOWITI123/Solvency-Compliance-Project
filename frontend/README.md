# SolvaSure Kenya

A visually-driven solvency compliance tracking and reporting platform for Kenyan micro-insurers, regulators, and administrators, designed for simplicity and accessibility.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/KOWITI123/Blockchain-Solvency-Compliance)

## Project Overview

SolvaSure Kenya is a comprehensive, visually stunning, and highly intuitive web application designed to empower micro-insurers in Kenya with seamless solvency compliance tracking. The platform provides distinct, role-based interfaces for Insurers, Regulators, and Administrators. Insurers can input financial data, monitor their real-time compliance status against IRA requirements, and visualize trends through an elegant dashboard. Regulators have a read-only audit view with aggregated data and powerful filtering capabilities. Administrators manage the system through a dedicated panel. The application is architected with a mobile-first approach, featuring offline capabilities for data submission and adherence to WCAG 2.1 accessibility standards, ensuring it is usable by individuals with varying levels of technological literacy.

## Key Features

-   **Role-Based Access Control:** Tailored dashboards and functionalities for Insurers, Regulators, and Administrators.
-   **Financial Data Input:** Simple and intuitive forms for submitting capital and liability data.
-   **Real-time Compliance Status:** Instant visual feedback on solvency status against IRA thresholds.
-   **Interactive Dashboards:** Data visualization with charts (line, bar, pie) to track trends over time.
-   **Blockchain Log:** A transparent, immutable record of all financial submissions.
-   **Offline Support:** Queue data submissions offline and sync automatically when connectivity is restored.
-   **Responsive & Accessible:** Designed mobile-first and adheres to WCAG 2.1 standards for usability.
-   **Audit & Admin Panels:** Dedicated interfaces for regulatory oversight and system management.

## Technology Stack

-   **Frontend:** React, Vite, React Router
-   **Styling:** Tailwind CSS, shadcn/ui
-   **State Management:** Zustand
-   **Forms:** React Hook Form, Zod
-   **Data Visualization:** Recharts
-   **Icons:** Lucide React
-   **Animations:** Framer Motion
-   **Backend:** Cloudflare Workers with Hono

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   [Bun](https://bun.sh/) installed on your machine.
-   A code editor of your choice (e.g., VS Code).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/solvasure-kenya.git
    cd solvasure-kenya
    ```

2.  **Install dependencies:**
    The project uses `bun` for package management.
    ```bash
    bun install
    ```

### Running the Development Server

To start the local development server, run the following command:

```bash
bun dev
```

The application will be available at `http://localhost:3000` (or another port if 3000 is in use). The server will automatically reload when you make changes to the code.

## Project Structure

-   `src/`: Contains all the frontend React application code.
    -   `components/`: Shared and UI components (built with shadcn/ui).
    -   `pages/`: Top-level route components.
    -   `lib/`: Utilities, mock data, and type definitions.
    -   `stores/`: Zustand state management stores.
    -   `main.tsx`: The main entry point of the application, including the router setup.
-   `worker/`: Contains the Cloudflare Worker backend code using Hono.
-   `public/`: Static assets that are served directly.

## Development

-   **Components:** We leverage `shadcn/ui` for our component library. Import components from `@/components/ui/*`. Avoid creating new components if a suitable one already exists.
-   **Styling:** All styling is done using Tailwind CSS utility classes. Custom styles and theme variables are defined in `tailwind.config.js` and `src/index.css`.
-   **State Management:** Global state is managed with Zustand. Stores are organized by domain (e.g., `authStore`, `dataStore`) and are located in the `src/stores` directory.

## Deployment

This project is configured for seamless deployment to Cloudflare Pages.

1.  **Build the application:**
    This command bundles the React frontend and the Cloudflare Worker for production.
    ```bash
    bun run build
    ```

2.  **Deploy to Cloudflare:**
    Run the deploy script, which uses the Wrangler CLI to publish your application.
    ```bash
    bun run deploy
    ```

Alternatively, you can connect your GitHub repository to Cloudflare Pages for automatic deployments on every push to your main branch.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/KOWITI123/Blockchain-Solvency-Compliance)

## Available Scripts

-   `bun dev`: Starts the development server.
-   `bun build`: Builds the application for production.
-   `bun lint`: Lints the codebase using ESLint.
-   `bun deploy`: Deploys the application to Cloudflare.

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.