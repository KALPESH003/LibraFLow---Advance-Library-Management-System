# LibraFLow: Advanced Library Management System
LibraFlow is a sleek, web-based Library Management System built using pure HTML, CSS, and JavaScript. It supports role-based operations for admins, librarians, and members, features an intelligent multitasking task queue, animated UI, real-time activity logs, and offline data persistence with localStorage.
---

## Features

- **Multi-Role Management**
  - Separate modules for **Admin**, **Librarian**, and **Member** users.
  - Role-based access control with modular UI elements.

- **Book Management**
  - Add, edit, delete, and issue books dynamically.  
  - Automated availability tracking and return reminders.

- **Smart Task Queue**
  - Handles multiple operations simultaneously for seamless multitasking.  
  - Prevents conflicts during concurrent user actions.

- **Notifications**
  - Pop-up alerts and toast messages for borrowing, returns, and due-date reminders.

- **Modern Animated UI**
  - Smooth transitions, subtle hover effects, and dynamic dashboards.  
  - Built with responsive layouts for both desktop and mobile devices.

- **Local Data Persistence**
  - Uses **LocalStorage** for maintaining book and user data.  
  - Works completely offline—no server required.

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6) |
| **Data Storage** | LocalStorage API |
| **UI Enhancements** | CSS Animations, Flexbox, Grid |
| **Optional Extensions** | Chart.js (for analytics), IndexedDB (for large data) |

---

## Folder Structure
```bash
LibraFlow/
├── index.html # Main file
├── style.css 
├── app.js # Core functionality (role-based logic)
├── assets/ # Designing elements
└── README.md # Project documentation
```

---

## How It Works

1. **Admin** can add or remove books, manage users, and monitor transactions.  
2. **Librarian** handles daily operations like issuing, returning, and cataloging books.  
3. **Members** can browse, reserve, or return books.  
4. All data persists locally via the **LocalStorage API**.

---

## Learning Outcomes

- Frontend architecture & modular JS design  
- Local data persistence using browser APIs  
- Role-based UI and event-driven programming  
- User experience optimisation via animation and responsive layouts  

---

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/LibraFlow.git
   ```
2. Navigate into the folder
3. Open index.html in your browser to start the application.
