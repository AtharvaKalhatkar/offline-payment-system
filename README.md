# 💸 Offline UPI Payment System
**A Full-Stack Decentralized Payment Solution for Offline Environments**

This project demonstrates a secure way to perform UPI-style transactions without an active internet connection. It uses a **Spring Boot** backend for secure JWT signing and a **React Native** mobile frontend for a seamless user experience.

---

## 🚀 Key Features
* **Offline Vault (JWT-Based):** Stores cryptographically signed value tokens locally on the device using `AsyncStorage`.
* **Visual Handshake:** Uses dynamic QR codes to transfer transaction data between devices.
* **Secure QR Scanner:** Integrated camera functionality to verify and accept offline payments.
* **Full-Stack Architecture:** Connects a mobile client with a robust Java backend for initial fund loading.


---

## 🛠️ Tech Stack
* **Mobile:** React Native, Expo, TypeScript, `react-native-qrcode-svg`
* **Backend:** Java 17, Spring Boot, Spring Security (JWT), PostgreSQL
* **Storage:** React Native AsyncStorage (Local), PostgreSQL (Cloud)

---

## 🛡️ Security Logic
1.  **Fund Loading:** The user loads money into the "Offline Vault" while online.
2.  **JWT Signing:** The Spring Boot backend signs a token containing the user ID and amount.
3.  **Offline Transfer:** When paying, the app generates a QR code containing this secure token.
4.  **Verification:** The receiver's app scans the QR and verifies the signature (Handshake) before updating the local ledger.

---

## 👨‍💻 Developed By
**Atharva Kalhatkar** *Information Technology Student at Savitribai Phule Pune University (SPPU)*