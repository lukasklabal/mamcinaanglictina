# Angličtina pro Lenku 🇬🇧

Osobní mobilní aplikace (PWA) pro učení angličtiny. Je určená pro jednu uživatelku, Lenku. Ta zvládá tři základní časy a jednoduchou konverzaci.

## Co aplikace umí

**Dnes**: denní cíl s kruhovým ukazatelem, série dní v řadě a Dnešní plán (opakování, nová lekce a bonus podle dne v týdnu). K tomu Slovíčko dne s výslovností.

**Lekce**: 12 témat ze života (seznámení, rodina, kavárna, restaurace, nakupování, cestování, město, zdraví, domov, počasí, volný čas, plány a telefon). Každé téma má 6 lekcí:
1. Slovíčka I a II (12 slovíček s příkladovými větami)
2. Užitečné fráze + gramatický tip
3. Rozhovor: partner mluví a Lenka vybírá odpověď. Dva různé hlasy.
4. Příběh: čtení s poslechem, překlad po klepnutí a otázky
5. Test tématu. Od 70 % se odemkne dovednost „Umím…“

Dál je tu **gramatika** (5 časů s vysvětlením, vzorci a příklady) a **35 nepravidelných sloves**.

**Procvičit**: opakování v intervalech (SRS), poslech, výslovnost (rozpoznávání řeči), skládání vět, dvojice, gramatika, rozhovory a příběhy.
Testy: Rychlovka 60 s, Velký test s odhadem úrovně (A0–A2+), Test časů a Poslechový test.

**Pokrok**:
- přehled: série, XP, naučená slovíčka, minuty, graf za 7 dní, kalendář za 15 týdnů, úspěšnost a historie testů
- 6 dovedností s úrovněmi
- sbírka: 28 odznaků, 24 dovedností „Umím…“ a slovníček s vyhledáváním

**Nastavení**:
- světlý, tmavý nebo automatický režim
- velikost písma
- britský nebo americký přízvuk, výběr hlasu a rychlost řeči
- denní cíl
- zvuky a vibrace
- záloha a obnovení dat

## Hlas

Aplikace používá hlasy přímo z telefonu (Web Speech API) a sama vybere ten nejpřirozenější (Premium / Enhanced / Siri / Google / Natural). Nejlepší kvalitu získáte takto:
- **iPhone:** Nastavení → Zpřístupnění → Předčítaný obsah → Hlasy → Angličtina. Stáhněte hlas s označením *Prémiový* (např. Ava, Zoe nebo Serena).
- **Android:** Nastavení → Usnadnění → Převod textu na řeč → Google → Nainstalovat hlasová data → Angličtina.

## Technika

- čisté HTML, CSS a JavaScript (ES moduly), bez sestavování a bez závislostí
- offline režim přes service worker (`sw.js`); při změně souborů zvyšte `VERSION`
- data se ukládají do `localStorage` v telefonu, zálohu lze stáhnout v Nastavení
- obsah lekcí najdete v `js/data/units.js` a `js/data/grammar.js`

### Spuštění lokálně

```bash
python3 .claude/devserver.py
```

Pak otevřete http://localhost:5173.
