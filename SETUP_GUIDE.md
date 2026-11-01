# Nexus: poora setup guide (Hinglish)

Ye guide aapko zero se live website, admin panel aur Play Store tak le jati hai.
Har step ke aage likha hai ki kaun karega: **[aap]** ya **[ho chuka]**.

---

## 0. Aapke paas kya hai (is ZIP ke andar)

| File | Kaam |
|---|---|
| `index.html` | Poori app (habits, tasks, water, notes, badges, login, premium) |
| `admin.html` | Admin Panel (sirf admins ke liye) |
| `config.js` | **Sirf yahi ek file aapko edit karni hai** (Supabase URL aur key) |
| `1_database_setup.sql` | Database + user ka alag data + security rules |
| `2_admin_setup.sql` | Admin panel, premium, announcements, feedback ka database |
| `privacy.html` | Privacy Policy ka template (Play Store ke liye zaroori) |
| `manifest.webmanifest`, `sw.js`, `icons/` | App install aur offline ke liye |
| `.nojekyll`, `.well-known/assetlinks.json` | GitHub Pages aur Android app ke liye |
| `native.js` | Android app me AdMob banner (website par kuch nahi karta) |
| `android-app/` | Android app (Capacitor) ka scaffold + README |
| `supabase/functions/store-webhook/` | Play subscription -> Premium (RevenueCat webhook) |
| `store/` + `STORE_LISTING.md` | Play Store ke screenshots, feature graphic aur listing text |

**Dhyan:** `config.js` khali rakhoge to app pehle jaisa chalegi (data sirf phone me, koi login nahi).

---

## 1. Supabase banao (database + login)  **[aap]**  ~15 min

1. https://supabase.com par free account banao -> **New project**.
   Name `nexus`, ek strong database password (save kar lo), region = aapke users ke paas.
2. Left menu **SQL Editor** -> **New query**.
   - `1_database_setup.sql` ka poora content paste karo -> **Run** (Success aana chahiye).
   - Phir naya query kholo, `2_admin_setup.sql` paste karo -> **Run**.
3. **Authentication** me:
   - Providers -> **Email** ON, **Confirm email** ON.
   - Password minimum length = **8**.
   - **URL Configuration**: *Site URL* = aapka website link (step 2 ke baad milega, jaise `https://username.github.io/nexus/`). *Redirect URLs* me wahi link add karo.
4. **Project Settings -> API** se **Project URL** aur **anon / publishable key** copy karo.
5. `config.js` kholo aur bharo:
   ```js
   window.NEXUS_CONFIG = {
     url: 'https://xxxx.supabase.co',
     key: 'eyJ...ya sb_publishable_...'
   };
   ```
   **KABHI** `service_role` ya `secret` key mat daalna.
6. Free email limit kam hai (kuch mail per ghanta). Launch se pehle **Project Settings -> Authentication -> SMTP** me Resend ya Brevo jaisi email service jodo.

---

## 2. Website live karo (GitHub Pages)  **[aap]**  ~10 min

1. GitHub par nayi repository banao (Public), naam jaise `nexus`.
2. ZIP extract karo. **Add file -> Upload files** me saari files upload karo
   (`.nojekyll` aur `.well-known` folder bhi; agar dikhe nahi to unhe alag se upload karo).
3. **Settings -> Pages -> Source: Deploy from a branch -> main -> /(root) -> Save**.
4. 1-2 minute baad link: `https://<username>.github.io/nexus/`.
5. Is link ko Supabase ke **Site URL / Redirect URLs** (step 1.3) me daalo.
6. Admin panel: `https://<username>.github.io/nexus/admin.html`

**Update karte waqt:** file badlo, upload karo, aur `sw.js` me `nexus-v3` ko `nexus-v4` (v5...) kar do, warna phone par purana version dikhega.

---

## 3. Khud ko Admin banao  **[aap]**  ~2 min

1. Website par jaakar **Settings -> Account -> Sign up** se apne email se account banao aur email confirm karo.
2. Supabase **SQL Editor** me ye chalao (apna email likho):
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
   ```
3. `admin.html` kholo aur usi email se login karo. Settings me ab "Open Admin Panel" bhi dikhega.

Admin panel me kya hai: Dashboard (users ke numbers aur graph), Users (search, Premium dena, Suspend, Note, CSV export),
Announcements (sab users ko message), App settings (maintenance banner, premium themes, support email),
**Premium codes** (code banao, user app me redeem kare), Feedback, Audit log (kisne kya badla).

**Privacy:** admin sirf email, plan aur activity dekhta hai. Users ke notes aur habits admin panel se nahi padhe ja sakte.

---

## 4. Test checklist (asli par, zaroor karo)  **[aap]**

- [ ] Sign up -> email aati hai -> link dabane par login ho jata hai.
- [ ] Dashboard par "Backed up just now" dikhta hai; Supabase -> Table Editor -> `user_data` me row aayi.
- [ ] Doosre phone/browser me login -> data aa jata hai; ek jagah tick karo -> doosri jagah dikhta hai.
- [ ] Forgot password -> email -> naya password -> login.
- [ ] **Do alag emails banao: ek ka data doosre ko kabhi nahi dikhna chahiye.**
- [ ] Admin panel me login, users dikhte hain. Ek test user ko Premium do -> uske app me "Premium until ..." dikhe.
- [ ] Announcement banao -> user ke home par dikhe. Admin se Suspend karo -> user ka cloud backup band ho jaye.
- [ ] Ek **non-admin** account se `admin.html` kholo -> "not an admin" aana chahiye.
- [ ] Admin panel -> Premium codes -> 1 code banao -> kisi user ke app me (Settings -> Have a Premium code?) redeem karo -> Premium mil jaye; wahi code doosra user use na kar sake.
- [ ] `config.js` me `storeUrl` daalo; 7 alag din use karne ke baad "Rate" banner aata hai.
- [ ] Internet band karke tick karo -> "Offline" dikhe -> internet aane par upload ho.
- [ ] Phone par "Install app" / Add to Home Screen chalta hai (https link par).

---

## 5. Premium aur paisa

Premium ke 3 tareeke hain (teeno ek saath chal sakte hain; time jud jata hai, kabhi ghat'ta nahi):

1. **Admin manually:** Admin panel -> Users -> Premium (+30/+90/+365 din ya date).
2. **Premium codes (sabse aasan, Play ke bina):** Admin panel -> Premium codes. Code banao (jaise 30 din, 1 use).
   Code user ko bech do ya gift karo (UPI/WhatsApp wagairah se - ye aapka apna dhanda hai).
   User app me Settings -> "Have a Premium code?" ya "Go Premium" screen par code daalta hai. Galat code 10 baar se zyada try karne par
   1 ghante ke liye rok diya jata hai.
3. **Google Play subscription (Android app me):** user Play Store se subscribe kare -> RevenueCat -> hamara `store-webhook` function ->
   Premium apne aap. Setup:
   - RevenueCat (revenuecat.com, free tak) me project banao, Google Play se jodo, ek subscription product banao.
   - Supabase me function deploy (computer par Supabase CLI chahiye):
     ```
     supabase functions deploy store-webhook --no-verify-jwt
     supabase secrets set REVENUECAT_WEBHOOK_AUTH="koi-lamba-random-secret"
     ```
   - RevenueCat -> Integrations -> Webhooks: URL `https://<project>.supabase.co/functions/v1/store-webhook`, Authorization = wahi secret.
   - Android app me RevenueCat ka plugin jodo aur login me **Supabase user id** ko RevenueCat "app user id" rakho
     (varna payment kisi user se judega nahi). Purchase button `openUpgrade()` ke andar lagao.
   - **Ye hissa maine asli RevenueCat/Google Play se test nahi kiya.** Play me test purchase karke dekhna zaroori hai.

**Ads (AdMob):** sirf Android app me, `android-app/README.md` ke steps se. Free users ko banner dikhta hai, Premium ko nahi.
Admin panel me ads ki kamai nahi aati; wo AdMob console me dekhni hoti hai.

**Security header (CSP):** `index.html` aur `admin.html` ke upar ek `Content-Security-Policy` line hai jo sirf `*.supabase.co` se baat karne deti hai.
Agar aap Supabase ka **custom domain** use karo, to us line me `https://*.supabase.co` ki jagah apna domain likhna.

---

## 6. Android app (Phase 6)  **[aap]**

Do rasta hain:

**Rasta A: PWABuilder / Bubblewrap (aasan, bina ads ke)**
1. https://www.pwabuilder.com par apna website link daalo -> Android package banao (signing key save karke rakhna!).
2. Package name jaise `com.yourname.nexus`. `.well-known/assetlinks.json` me package name aur SHA-256 fingerprint daalo.
3. **Zaroori:** `assetlinks.json` domain ke **root** par hona chahiye (`https://domain.com/.well-known/assetlinks.json`).
   `username.github.io/nexus/` (project page) par ye kaam nahi karta. Iske liye ya to `username.github.io` naam ki repo banao
   ya apna custom domain jodo (GitHub Pages me free).
4. Is rasta me **AdMob nahi chalta** aur Play Billing mushkil hai.

**Rasta B: Capacitor wrapper (AdMob + subscription chahiye to ye)**
`android-app/` folder me scaffold aur step-by-step `README.md` hai (Node.js + Android Studio chahiye). AdMob banner ka code `native.js` me ready hai.
**Ye maine build ya test nahi kiya** (mere paas Android tools nahi hain). Pehle test ads (`admobTesting: true`) ke saath chalana.

---

## 7. Google Play Store (Phase 7)  **[aap]**

1. Play Console developer account (ek baar ki fees lagti hai; identity verify hoti hai).
2. App banao: naam, description, category (Health & Fitness ya Productivity).
3. Zaroori cheezein ready hain: `store/app_icon_512.png`, `store/feature_graphic_1024x500.png`, `store/screenshots/` (5 phone screenshots). Listing ka text `STORE_LISTING.md` me hai.
4. **Privacy Policy URL**: `privacy.html` ko pehle bharo (apna naam, email, tareekh) aur uska link daalo.
5. **Data safety form** me sach batao: email (account), app data (habits/notes) cloud me, feedback. Agar AdMob use kiya to advertising ID bhi.
6. **Account delete**: app me "Delete my account" maujood hai; Play ko web link bhi chahiye: `privacy.html#delete`.
7. Content rating questionnaire, target audience, ads declaration (ads hain ya nahi).
8. **Testing rule:** naye personal developer accounts ko production se pehle closed testing me kuch testers ke saath
   kuch din chalana padta hai. Ye rule badalta rehta hai, isliye Play Console ki current requirement zaroor padho.
9. Review ke baad publish. Update ke waqt version code badhao.

---

## 8. Launch ke baad (Phase 8)

- Feedback: Admin panel -> Feedback. Naye features Announcements se batao.
- Users ka growth: Admin panel -> Dashboard.
- Har update: file badlo -> `sw.js` ka version badlo -> upload.
- Supabase ka backup/export kabhi-kabhi lo. Free plan par inactivity me project pause ho sakta hai; asli users aane par Pro plan lo.

---

## 9. Jo is code me abhi nahi hai (seedhi baat)

- Android app ka build, AdMob ke asli ads, Play Billing ka purchase button, Play Store submit: ye computer/Android Studio aur aapke accounts se hone hain. Code/scaffold ready hai par maine inhe chalaya nahi.
- Push notifications (app band hone par): Android app me FCM se hogi. Abhi reminder sirf app khula ho tab chalta hai.
- Do devices ke offline badlav ka **automatic merge** nahi hai; app poochta hai kaunsa data rakhna hai (safety copy ke saath).
- Is code ko **asli Supabase par** maine nahi chalaya (mere paas account nahi hai). Maine nakli server par 70+ test chalaye.
  Isliye step 4 ki checklist zaroor chalao, khaas kar SQL files aur "do users ka data alag" wali check.
- Admin ka password manager me rakho aur kabhi share mat karo; admin account me 2-step verification on karo (Supabase me nahi, apne email me).
