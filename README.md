# Reweave

Reweave is a web app for building a more thoughtful relationship with clothing. It combines a digital wardrobe with garment-care habits, outfit sharing, and a second-hand marketplace. Users can add clothing to their closet, scan a care tag to help record its fabric composition, and track a cotton plant that grows as they care for it.

The interface is available in English and Thai. Image preparation and tag scanning run in the browser; account, wardrobe, community, and marketplace data use Firebase.

## Features

- **Plant-care journey:** Water a virtual cotton plant, track care days and streaks, and see its growth stage.
- **Digital closet:** Add and edit garments, organize them into closets, and search or filter by garment type, color, and closet.
- **Garment photo tools:** Upload a garment photo to remove its background and estimate its color.
- **Care-tag scanning:** Use OCR to read an English clothing-tag photo, then extract recognized fabric names and percentages. Scanning is a helper, so check the result for accuracy.
- **Fabric insights:** Estimate the share of natural fibers in the saved wardrobe compositions.
- **Community:** Share outfit posts, interact with posts, and connect with friends through requests and messages.
- **Marketplace:** Create and browse second-hand clothing listings. Purchases are demo transactions, not real payment processing.
- **Profiles and preferences:** Manage profile details, choose English or Thai, and configure app preferences.

## Tech stack

| Technology | Role in Reweave |
| --- | --- |
| React 19 | Builds the interactive application and its screens. |
| TypeScript | Adds static types to the app and its data models. |
| Vite | Runs the local development server and builds the production frontend. |
| Firebase Authentication | Provides email/password account creation, sign-in, and session state. |
| Cloud Firestore | Stores user, garment, community, and marketplace data, with live subscriptions and persistent browser caching. |
| `@imgly/background-removal` | Removes backgrounds from uploaded garment photos in the browser. |
| Tesseract.js | Performs English OCR on care-tag photos in the browser. |
| Tailwind CSS and custom CSS | Provide the styling foundation and app-specific layouts, themes, and components. |
| Lucide React | Supplies interface icons. |
| Browser Canvas and project utilities | Resize and crop garment images, estimate their colors, and parse OCR text into fabric compositions. |
| Browser `localStorage` | Persists selected local preferences, including language and notification settings. |

## Project layout

```text
src/
  App.tsx             Main application screens and feature flows
  AuthGate.tsx        Sign-up, sign-in, and authentication state
  firebase.ts         Firebase app, Authentication, and Firestore setup
  userData.ts         Firestore operations for user, closet, community, and market data
  ImageTools.ts       Garment image preparation and tag OCR
  composition.ts      Fabric composition parsing and natural-fiber calculations
  colors.ts           Garment color estimation and color-name styling
  plant.ts            Cotton plant growth and care rules
  communityTypes.ts   Shared community and marketplace data types
  Helptour.tsx        Guided in-app tour
  index.css           Tailwind import and application styles
  main.tsx            React entry point
```

## Getting started

### Requirements

- Node.js and npm
- A Firebase project setup

## Notes

- Background removal and OCR load their browser-side models when needed, so the first use may take longer and requires downloading the model.
- OCR reads English (`eng`) tag text. Review the extracted composition before relying on it.
- Marketplace checkout is a demo flow. It records the simulated order in Firestore but does not charge a payment method.
