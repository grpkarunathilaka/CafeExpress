# Café Express — Ultra-Lightweight Single Page Application

Café Express is a production-ready, high-performance, ultra-lightweight restaurant Single Page Application (SPA) boilerplate template designed to load and organize over 100+ menu items dynamically with zero image assets.

It uses Angular (standalone component structure) and processes dynamic menu datasets in the browser, parsing them directly from a published Google Sheets CSV endpoint. It relies strictly on elegant serif and sans-serif typography, clean grids, and subtle borders to achieve a 100% mobile performance score.

---

## 📋 Google Sheets Setup & CSV Source Context

To connect your own menu spreadsheet to this application, arrange your Google Sheet columns exactly as described below before publishing.

### 1. Column Schema Layout

Arrange columns starting from Column A:

| Column | Header Name | Expected Value Format | Example |
|---|---|---|---|
| **A** | `Category` | Repeat the section name for every item in it. | `All Day Breakfast` |
| **B** | `ItemName` | Plain text name of the dish or drink. | `Smashed Avocado Toast` |
| **C** | `Description` | Detailed ingredient list. Commas inside description are handled safely. | `Mashed avocado, heirloom tomatoes, Danish feta, chili flakes on sourdough.` |
| **D** | `Price` | Decimal price value (currency symbol is optional and cleaned dynamically). | `18.90` |
| **E** | `isVegetarian`| Type `TRUE` if vegetarian; leave blank or type `FALSE` otherwise. | `TRUE` |
| **F** | `isGlutenFree`| Type `TRUE` if gluten-free; leave blank or type `FALSE` otherwise. | `TRUE` |

*Note: The first row must be the header containing columns: `Category,ItemName,Description,Price,isVegetarian,isGlutenFree`.*

### 2. Publishing to the Web (CSV Format)

To get a published URL endpoint from Google Sheets:
1. Open your Google Sheet menu file.
2. Navigate to **File** -> **Share** -> **Publish to Web**.
3. In the dialog box:
   - Under the Link/Embed tab, select the sheet containing the menu (or choose "Entire Document").
   - Change the export type dropdown from *Web Page* to **Comma-separated values (.csv)**.
4. Click **Publish** and copy the generated URL.

### 3. Application Environment Configuration

Open [environment.ts](file:///e:/Code/CafeExpress/src/environments/environment.ts) and paste your copied URL into the `menuCsvUrl` property:

```typescript
export const environment = {
  production: false,
  menuCsvUrl: 'YOUR_PUBLISHED_GOOGLE_SHEETS_CSV_URL_HERE'
};
```

---

## 🛠️ Project Development Guide

This project was built using Angular standalone configuration.

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run start
   ```
3. Open your browser to `http://localhost:4200/`.

### Production Build

To compile a highly optimized production bundle, run:
```bash
npm run build
```
The output will be stored inside the `dist/` directory, ready to be deployed to static hosting solutions like Netlify, Vercel, or GitHub Pages.

---

## ⚡ Architectural Features

- **Signals-Driven Reactivity**: Reactive states (loading, error, search queries, active category) utilize Angular Signals for lightning-fast rendering.
- **Robust Client-Side Parser**: The `MenuService` contains a custom state-machine parser that correctly parses complex CSV text, handles escaped quotes (`""`), and filters out empty lines.
- **Local Fallback Mode**: If the Google Sheet URL is missing or fails to resolve due to network issues, the application automatically falls back to an embedded offline menu featuring 107 items to ensure zero downtime.
- **Dotted-Leader Layout**: Responsive layout displaying items in a clean 2-column grid on desktop and 1-column list on mobile. Price and ItemName are separated by a dotted leader line (`. . . . . . . .`) with description in muted text below.
- **IntersectionObserver Navigation**: The horizontal sub-header category quick-links bar reads the parsed unique category tags. Clicking a link leaps the user to the section. As the user scrolls, the observer tracks the visible section in real-time, automatically updating the active nav link and scrolling it into view.
