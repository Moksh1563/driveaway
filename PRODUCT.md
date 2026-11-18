# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Luxury and exotic car renters in Ahmedabad: people hiring a hypercar, supercar or luxury car for a wedding, shoot, celebration, weekend drive or because they love the car. They browse the fleet, compare a few cars, pick dates and a pickup hub, and book. A second audience is the business's admin team, who manage fleet status, bookings, customers, promo codes and inquiries.

## Product Purpose

Driveaway rents exotic and luxury cars in Ahmedabad with online booking in minutes. The site has to make the cars desirable and make booking feel effortless and trustworthy. For now it is primarily shown as a demonstration, so a memorable first impression matters most (confirmed by the owner: "wow factor for a demo").

## Positioning

A hypercar-and-supercar fleet (Bugatti, Koenigsegg, Pagani, Ferrari, McLaren, Lamborghini, Rolls-Royce, Bentley and similar) bookable online like an everyday rental, with pickup across eight Ahmedabad hubs.

## Operating Context

- Customer flow: home → fleet (filter by type, fuel, transmission, price, search) → car detail (gallery, specs, reviews) → 3-step booking (trip details, driver info, confirm) → pay by cash at pickup or simulated online payment (test-mode gateway) → booking success with PDF and WhatsApp invoice → dashboard (bookings, pay, cancel, review, profile, password).
- Unavailable cars offer "notify me when available" email alerts.
- Discount codes at checkout; newsletter/discount alert subscription; loyalty points (earn 1 pt per ₹100, 10 pts = ₹1, up to 50% off).
- Admin panel: dashboard analytics, fleet CRUD with image upload, bookings management, users, discounts with email broadcast, contact inquiries.
- Pickup hubs: SG Highway, Vastrapur, Bopal, Ashram Road, Ahmedabad Airport, BRTS Bus Stand, Navrangpura, Satellite.

## Capabilities and Constraints

- Stack: React 18 + Vite + Tailwind CSS + framer-motion frontend; Express + MongoDB backend. Keep the stack.
- Every existing feature must be kept (owner requirement).
- Prices in ₹ (en-IN formatting), daily rates.
- Car photos come from remote URLs (Unsplash) or admin uploads; the seeded photos do not always match the named car.

## Brand Commitments

- Name: Driveaway (written "Driveaway", with "away" visually distinguished today).
- Logo: the car-icon logo mark must stay.
- Both dark and light themes must remain, with a user toggle.
- The current amber accent colour is not a commitment and may change.

## Evidence on Hand

- Real fleet data in the database (18 cars with specs, rates, ratings, review counts).
- Home-page testimonials and stats ("50+ cars", "10K+ happy rides", "4.9 rating") are placeholder copy, not verified figures; do not add new invented claims.
- Hero image: public/images/luxury_hypercars_header.webp.

## Product Principles

1. The cars are the hero; interface chrome stays out of their way.
2. Booking must never feel harder than admiring the car.
3. Every feature remains reachable; nothing is cut for looks.
4. Impress at first sight, but stay honest: no new invented numbers or testimonials.
