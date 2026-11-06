# Play Store listing (copy-paste ready)

Ye English me hai. Apni marzi se badlo. Hindi listing bhi daal sakte ho (Play Console me "Add translation").

## Basics
- **App name** (max 30): `GoalForce: Habit Tracker`
- **Short description** (max 80): `Build habits with streaks, levels, badges, tasks and a water tracker.`
- **Category:** Health & Fitness (ya Productivity)
- **Tags:** habit tracker, productivity, self improvement
- **Contact email:** [aapka email]
- **Privacy policy URL:** `https://[aapki site]/privacy.html` (pehle bharo)
- **Account deletion URL:** `https://[aapki site]/privacy.html#delete`

## Full description (max 4000)
Turn your daily routine into a game. GoalForce is a habit tracker that rewards you for showing up.

**What you get**
- Daily habits with streaks, weekly schedules and "do it 8 times a day" goals
- XP, levels and 50 badges that unlock as you grow
- Tasks: one-time, weekly or monthly
- A water tracker with a body that fills as you drink
- Notes to write about your day and what you missed
- 11 themes, from Night to Aurora
- Works offline. Your data stays on your phone
- Optional free account: back up your data and use GoalForce on more than one device
- Premium: extra themes and no ads

**Your data, your choice**
You can use GoalForce without an account. If you create one, your habits are backed up securely and you can delete your account and data any time inside the app.

## What's new (first release)
First release of GoalForce. Build habits, earn XP, unlock badges.

## Graphics (is folder `store/` me ready hain)
- App icon 512x512: `store/app_icon_512.png`
- Feature graphic 1024x500: `store/feature_graphic_1024x500.png`
- Phone screenshots 1080x1920 (5): `store/screenshots/`
  (Play ko kam se kam 2 chahiye. Naye design ke baad dobara le sakte ho.)

## Data safety form (sach batao; neeche ka draft check karke bharo)
| Sawal | Jawab |
|---|---|
| Data collect karte ho? | Haan, sirf agar user account banaye |
| Personal info | **Email address** (account banane ke liye) |
| App activity / user content | Habits, tasks, notes ka backup (app function ke liye) |
| Device or other IDs | **Haan agar AdMob lagaya** (advertising ID). Nahi lagaya to nahi |
| Data transit me encrypted? | Haan (HTTPS) |
| User data delete kara sakta hai? | Haan: app ke andar "Delete my account" + web link |
| Data bechte ho? | Nahi |
| Third party se share? | Ads (AdMob) lagaya to haan. Supabase/RevenueCat service providers hain |

Ye mera draft hai, final jawab aapki sachchi situation par depend karta hai. Play Console ke sawal ek-ek karke padho.

## Content rating / audience
- Questionnaire me: hinsa, gambling, adult content: **sab Nahi**. Rating "Everyone" aani chahiye.
- Target audience: 13+ ya 18+ chuno (bachchon ke liye nahi). Bachchon ko target karoge to Families policy ke extra niyam lagte hain.
- Ads declaration: agar AdMob hai to "Contains ads: Yes".

## Release se pehle
- [ ] `privacy.html` me [brackets] bhare
- [ ] Signed `.aab` upload kiya, keystore backup hai
- [ ] Closed testing me testers jode (Play ki current requirement check karo)
- [ ] In-app test: sign up, backup, delete account, premium code
