# Mood Pet Sanctuary

Interactive daily-ritual desk toy · p5.js + p5.sound + Open-Meteo API
一个把日常自我照顾变成小仪式的虚拟宠物互动装置

**Live demo:** https://peterlee0325.github.io/MoodPetSanctuary/ *(GitHub Pages)*
**Video documentation:** https://vimeo.com/1153421532

---

## EN — Concept

*Mood Pet Sanctuary* is an interactive p5.js "desk toy" that turns daily self-care into small rituals spent with a virtual pet. Instead of a conventional to-do list, users care for their companion through three simple actions — **feeding**, **cleaning**, and **writing a one-line memory**. Completing all three within a day triggers a "Shelter Completed" reward (coins, XP, unlocked content).

The idea grew from treating small, repetitive rituals like a game loop: clear goals, immediate feedback, a visible sense of progress. The pet is designed as a friendly interface agent — it reacts to the player's actions with animation and bilingual messages, and moves with simple steering/arrival behaviour (Reynolds, 1999) so it feels alive rather than teleporting between points. The daily "memory" action is a quiet reflective moment: one sentence becomes a star on a constellation panel, turning a habit-tracking action into a personal, visual keepsake.

## EN — How it's built

The code is organised around five modes (`ROOM / FEED / CLEAN / MEMORY / SHOP`) selected from a shared dock UI, with classes for the pet, food, dirt, stars and particles, and custom functions for save/load, weather effects, and UI cards. Weather is fetched once a day from the **Open-Meteo** API and cached locally — it doesn't just get displayed, it changes the simulation itself (e.g. more dirt spawns and the pet is less eager to "go outside" on rainy/stormy days, falling back gracefully to a neutral state if the API call fails). Coins earned through daily rituals can be spent on food tiers, cleaning boosts, cosmetics, and upgrades that ease long-term wear.

## Controls 操作说明
- Bottom dock switches modes: `ROOM / FEED / CLEAN / MEMORY / SHOP`
- **FEED** — choose a food tier, click the floor to drop food (higher tiers cost coins)
- **CLEAN** — drag to scrub dirt; "Bubble Soap" gives a temporary cleaning boost
- **MEMORY** — write one sentence, save it as a star; click stars to revisit past notes
- **SHOP** — buy upgrades/cosmetics, customise the pet's species and colour

---

## 中文 — 概念

《Mood Pet Sanctuary》是一个用 p5.js 做的互动"桌面玩具",把日常的自我照顾变成陪伴虚拟宠物的小仪式。用户不需要面对传统的待办清单,而是通过三个简单动作照顾自己的宠物——**喂食**、**清洁**、**写一句今日心情**。三件事在一天内都完成时,会触发"庇护所完成"奖励(金币、经验值、解锁内容)。

这个想法源于把细小、重复的日常仪式当作一个游戏循环来设计:清晰的目标、即时的反馈、可见的进度感。宠物被设计成一个友好的交互媒介——它会对玩家的动作做出动画反应,用双语文案交流,并采用简单的转向/到达行为(Reynolds, 1999)让移动显得自然而不是瞬移。每日的"记忆"动作是一个安静的反思时刻:写下一句话,它就会变成星座面板上的一颗星星,把习惯打卡变成了有温度的个人记录。

## 中文 — 技术实现

代码围绕五种模式(`ROOM / FEED / CLEAN / MEMORY / SHOP`)组织,通过底部统一的控制面板切换,并为宠物、食物、污渍、星星、粒子分别建立了类,配合自定义函数实现存档读档、天气效果和界面卡片。天气信息每天从 **Open-Meteo** API 获取一次并做本地缓存——它不只是被展示出来,还会真正影响模拟本身(比如雨天/暴风雨天污渍生成变多、宠物出门探索的意愿降低;如果 API 调用失败,系统会优雅降级到中性天气继续运行)。通过每日仪式获得的金币可以用来购买食物等级、清洁加成、外观装扮,以及能减少长期磨损的升级项目。

---

## Tech stack 技术栈
p5.js · p5.sound · Open-Meteo (weather API) · localStorage (save/load)

## Files 文件结构
```
index.html   entry point
sketch.js    five-mode game loop, pet/food/dirt/star/particle classes, weather integration
style.css    UI styling
```

Built by Haoming Li, MA Computer Arts, Goldsmiths, University of London.

### Reference
Reynolds, C.W. (1999) 'Steering Behaviors For Autonomous Characters'. Proceedings of Game Developers Conference (GDC).
