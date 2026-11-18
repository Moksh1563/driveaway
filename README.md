# 🚗 Driveaway — Premium Car Rental Platform

**Ahmedabad's premier car rental web application.** Built as a full-stack MERN project for Semester 5.

---

## 📋 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS (dark/light), Framer Motion, Lucide React |
| Backend | Node.js, Express.js, Mongoose, JWT, bcryptjs |
| Database | MongoDB on Custom Port **27018** (`.mongodb_data`) |
| PDF | jsPDF + jspdf-autotable |
| Notifications | react-hot-toast |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
cd server && npm install && cd ..
```

### 2. Run Everything (MongoDB on 27018 + Express Server + Vite Frontend)

```bash
npm run dev:all
```

This single command starts:
- 🗄️ **MongoDB on Custom Port 27018**
- ⚙️ **Backend Express Server on Port 5000**
- 🎨 **Frontend Vite App on Port 5173**

---

### 3. Database Re-seeding (Optional)

```bash
npm run seed
```

This populates the `driveaway_custom_port` database on port 27018 with:
- 👤 An admin (`admin@driveaway.com`) and a demo customer (`customer@example.com`). Their passwords are
  random and printed once when seeding, or set your own with `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` in `server/.env`.
- 🚗 10 cars (Honda Civic, Ford Mustang, Hyundai Creta, BMW 3 Series, Maruti Swift, Nissan GT-R, Kia Seltos, Tata Nexon EV, Mercedes C-Class, Tata Harrier)
- 🎟️ Discount codes: `DRIVEAWAY20`, `NEWUSER10`, `AHMEDABAD15`
- 📋 3 sample bookings + 1 review
